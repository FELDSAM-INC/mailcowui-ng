// The UI 006 spam policy handlers (T080, T090, T116): spam scores with defaults, the 0.1 rule and
// the equal-values raise; allow and block lists of the three owner kinds with own and inherited
// entries, pattern rules, conflicts and flags; and the action statistics.
import { describe, expect, it } from 'vitest'

import { useScenario } from '../../mocks/node'

const api = (path: string) => `${location.origin}/api/v2${path}`

interface Answer {
  status: number
  headers: Headers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
  bytes?: Uint8Array
}

async function csrfToken(): Promise<string> {
  const response = await fetch(api('/csrf-token'))
  return ((await response.json()) as { data: { token: string } }).data.token
}

async function call(
  method: string,
  path: string,
  options: { body?: unknown; ifMatch?: string } = {},
): Promise<Answer> {
  const headers: Record<string, string> = {}
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken()
  if (options.body !== undefined) {
    headers['Content-Type'] =
      method === 'PATCH' ? 'application/merge-patch+json' : 'application/json'
  }
  if (options.ifMatch) headers['If-Match'] = options.ifMatch
  const response = await fetch(api(path), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const type = response.headers.get('content-type') ?? ''
  if (type && !type.includes('json')) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    return { status: response.status, headers: response.headers, body: undefined, bytes }
  }
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : undefined,
  }
}

const patterns = (answer: Answer) =>
  (answer.body.data as { pattern: string; own: boolean }[]).map(
    (entry) => `${entry.own ? 'own' : 'inherited'}:${entry.pattern}`,
  )

describe('spam scores', () => {
  it('reads the server defaults, sets values and resets them', async () => {
    useScenario('quarantine-mailbox-user')
    const read = await call('GET', '/mailboxes/alice@example.org/spam-score')
    expect(read.body.data).toMatchObject({
      junkScore: 8,
      rejectScore: 15,
      custom: false,
      defaults: { junkScore: 8, rejectScore: 15, fallback: false },
    })
    const saved = await call('PUT', '/mailboxes/alice@example.org/spam-score', {
      ifMatch: read.body.data.etag,
      body: { junkScore: 10, rejectScore: 10 },
    })
    expect(saved.body.data).toMatchObject({ junkScore: 10, rejectScore: 10.1, custom: true })
    expect(
      (
        await call('PUT', '/mailboxes/alice@example.org/spam-score', {
          ifMatch: read.body.data.etag,
          body: { junkScore: 4, rejectScore: 9 },
        })
      ).status,
    ).toBe(412)
    expect(
      (
        await call('DELETE', '/mailboxes/alice@example.org/spam-score', {
          ifMatch: saved.body.data.etag,
        })
      ).status,
    ).toBe(204)
    expect((await call('GET', '/mailboxes/alice@example.org/spam-score')).body.data.custom).toBe(
      false,
    )
  })

  it('refuses a junk score above the reject score and more than one decimal', async () => {
    useScenario('quarantine-mailbox-user')
    const above = await call('PUT', '/mailboxes/alice@example.org/spam-score', {
      body: { junkScore: 12, rejectScore: 6 },
    })
    expect(above.body.errors.junkScore[0]).toMatchObject({
      code: 'mustNotExceed',
      params: { field: 'rejectScore', value: 6 },
    })
    const decimals = await call('PUT', '/mailboxes/alice@example.org/spam-score', {
      body: { junkScore: 6.55, rejectScore: 12 },
    })
    expect(decimals.body.errors.junkScore[0]).toMatchObject({
      code: 'notMultipleOf',
      params: { factor: 0.1 },
    })
  })

  it('reports one stored value as custom and needs spamScore for a mailbox user', async () => {
    const state = useScenario('quarantine-mailbox-user')
    state.quarantine.spamScores['alice@example.org'] = { junkScore: 6, rejectScore: null }
    expect((await call('GET', '/mailboxes/alice@example.org/spam-score')).body.data).toMatchObject({
      junkScore: 6,
      rejectScore: 15,
      custom: true,
    })
    useScenario('quarantine-user-no-flags')
    const refused = await call('PUT', '/mailboxes/alice@example.org/spam-score', {
      body: { junkScore: 4, rejectScore: 9 },
    })
    expect(refused.body).toMatchObject({ requiredFlags: ['spamScore'] })
    useScenario('quarantine-admin')
    expect((await call('GET', '/mailboxes/MeetingRoom1@example.org/spam-score')).status).toBe(404)
  })
})

describe('allow and block lists', () => {
  it("lists a mailbox's own entries and its domain's, read-only", async () => {
    useScenario('quarantine-mailbox-user')
    await call('POST', '/mailboxes/alice@example.org/spam-policy-entries', {
      body: { list: 'block', pattern: ' *@Spam.Other ' },
    })
    const block = await call('GET', '/mailboxes/alice@example.org/spam-policy-entries?list=block')
    expect(patterns(block)).toEqual(['inherited:*@spam.example', 'own:*@spam.other'])
    const own = await call(
      'GET',
      '/mailboxes/alice@example.org/spam-policy-entries?list=block&ownership=own',
    )
    expect(patterns(own)).toEqual(['own:*@spam.other'])
  })

  it('refuses invalid, long and duplicate patterns', async () => {
    useScenario('quarantine-mailbox-user')
    const invalid = await call('POST', '/mailboxes/alice@example.org/spam-policy-entries', {
      body: { list: 'allow', pattern: 'user+tag@example.org' },
    })
    expect(invalid.body.errors.pattern[0]).toMatchObject({
      code: 'invalidFormat',
      params: { format: 'senderPattern' },
    })
    const wildcards = await call('POST', '/mailboxes/alice@example.org/spam-policy-entries', {
      body: { list: 'allow', pattern: '*@*' },
    })
    expect(wildcards.status).toBe(422)
    const long = await call('POST', '/mailboxes/alice@example.org/spam-policy-entries', {
      body: { list: 'allow', pattern: `${'a'.repeat(95)}@x.org` },
    })
    expect(long.body.errors.pattern[0].code).toBe('tooLong')
    const created = await call('POST', '/mailboxes/alice@example.org/spam-policy-entries', {
      body: { list: 'block', pattern: '*@ads.test' },
    })
    expect(created.status).toBe(201)
    expect(created.headers.get('location')).toBe(
      `/api/v2/mailboxes/alice@example.org/spam-policy-entries/${created.body.data.id}`,
    )
    const conflict = await call('POST', '/mailboxes/alice@example.org/spam-policy-entries', {
      body: { list: 'allow', pattern: '*@ADS.test' },
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body).toMatchObject({ list: 'block', entryId: created.body.data.id })
  })

  it('removes own entries only, with If-Match, and records them on the owner', async () => {
    const state = useScenario('quarantine-mailbox-user')
    const created = await call('POST', '/mailboxes/alice@example.org/spam-policy-entries', {
      body: { list: 'allow', pattern: '*@friends.example' },
    })
    const id = created.body.data.id as number
    expect(
      (await call('DELETE', '/mailboxes/alice@example.org/spam-policy-entries/1')).status,
    ).toBe(404)
    expect(
      (
        await call('DELETE', `/mailboxes/alice@example.org/spam-policy-entries/${id}`, {
          ifMatch: '"x"',
        })
      ).status,
    ).toBe(412)
    expect(
      (
        await call('DELETE', `/mailboxes/alice@example.org/spam-policy-entries/${id}`, {
          ifMatch: created.body.data.etag,
        })
      ).status,
    ).toBe(204)
    expect(state.auditEvents.at(-1)).toMatchObject({
      eventType: 'spamPolicyEntryRemoval',
      target: { type: 'mailbox', id: 'alice@example.org' },
      details: { entryId: id, list: 'allow', pattern: '*@friends.example' },
    })
  })

  it("shows a domain's mailbox entries as inherited and refuses mailbox users", async () => {
    useScenario('quarantine-admin')
    await call('POST', '/mailboxes/anna@example.org/spam-policy-entries', {
      body: { list: 'allow', pattern: '*@anna.example' },
    })
    const domain = await call('GET', '/domains/example.org/spam-policy-entries')
    expect(patterns(domain)).toEqual(['inherited:*@anna.example', 'own:*@spam.example'])
    expect(domain.body.data[0].owner).toEqual({ kind: 'mailbox', name: 'anna@example.org' })
    const alias = await call('POST', '/alias-domains/example.net/spam-policy-entries', {
      body: { list: 'block', pattern: '*@ads.test' },
    })
    expect(alias.status).toBe(201)
    useScenario('quarantine-mailbox-user')
    expect((await call('GET', '/domains/example.org/spam-policy-entries')).status).toBe(403)
  })

  it("needs spamPolicy for a domain administrator's writes", async () => {
    useScenario('quarantine-domain-admin', { flags: { reseller: { spamPolicy: false } } })
    expect((await call('GET', '/alias-domains/example.net/spam-policy-entries')).status).toBe(200)
    const refused = await call('POST', '/alias-domains/example.net/spam-policy-entries', {
      body: { list: 'block', pattern: '*@ads.test' },
    })
    expect(refused.body).toMatchObject({ requiredFlags: ['spamPolicy'] })
    expect((await call('GET', '/domains/other.example/spam-policy-entries')).status).toBe(404)
  })
})

describe('action statistics', () => {
  it('answer administrators, refuse others, and fail while the spam filter is unavailable', async () => {
    const state = useScenario('quarantine-admin')
    const answer = await call('GET', '/spam-filter-action-statistics')
    expect(answer.body.data).toMatchObject({
      rejected: 120,
      softRejected: 30,
      subjectRewritten: 0,
      movedToJunk: 250,
      noAction: 600,
      total: 1000,
    })
    state.quarantine.statistics = 'unavailable'
    const failed = await call('GET', '/spam-filter-action-statistics')
    expect(failed.status).toBe(503)
    expect(failed.body.dependency).toBe('spamFilter')
    useScenario('quarantine-domain-admin')
    expect((await call('GET', '/spam-filter-action-statistics')).status).toBe(403)
  })
})

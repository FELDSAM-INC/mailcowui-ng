// The UI 006 quarantine handlers (T026, T039, T059, T070, T107): every response passes the contract
// validator (the setup file fails a test on any violation), and API 006's documented behaviour holds:
// scope per role, filters, sort and paging, item details per role and flag, actions with reports
// and injected refusals, bulk results, downloads, settings and notification settings.
import { describe, expect, it } from 'vitest'

import { useScenario } from '../../mocks/node'
import { QUARANTINE_ITEM } from '../../mocks/factories/quarantine-item'
import { BULK_FAILURE_ITEM } from '../../mocks/scenarios/quarantine'

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

const ids = (answer: Answer) => (answer.body.data as { id: number }[]).map((item) => item.id)

describe('listQuarantineItems', () => {
  it('lists a mailbox user’s 30 items newest first, 25 per page', async () => {
    useScenario('quarantine-mailbox-user')
    const answer = await call('GET', '/quarantine')
    expect(answer.status).toBe(200)
    expect(answer.body.meta).toEqual({ total: 30, limit: 25, offset: 0 })
    expect(ids(answer)[0]).toBe(30)
    expect(ids(answer)).toHaveLength(25)
    const other = await call('GET', '/quarantine?action=other')
    expect(other.body.data[0]).toMatchObject({ action: 'other', filterAction: 'soft reject' })
  })

  it('limits a domain administrator to the domains they manage', async () => {
    useScenario('quarantine-domain-admin')
    const answer = await call('GET', '/quarantine?limit=1000')
    const recipients = new Set(
      (answer.body.data as { recipient: string }[]).map((item) => item.recipient.split('@')[1]),
    )
    expect([...recipients].sort()).toEqual(['example.com', 'example.org'])
  })

  it('filters by action, virus, notification, time and score, and searches', async () => {
    useScenario('quarantine-mailbox-user')
    const junk = await call('GET', '/quarantine?action=junk&action=subjectRewritten&limit=100')
    expect(
      (junk.body.data as { action: string }[]).every((item) =>
        ['junk', 'subjectRewritten'].includes(item.action),
      ),
    ).toBe(true)
    expect(ids(await call('GET', '/quarantine?virus=true'))).toEqual([QUARANTINE_ITEM.virus])
    const scored = await call('GET', '/quarantine?minScore=0&limit=100')
    expect(ids(scored)).not.toContain(QUARANTINE_ITEM.noScoreNoSubject)
    const search = await call('GET', '/quarantine?q=PHISH.EXAMPLE')
    expect(ids(search)).toEqual([QUARANTINE_ITEM.script])
    const all = await call('GET', '/quarantine?limit=100')
    const third = all.body.data[2].arrivedAt as string
    const range = await call(
      'GET',
      `/quarantine?from=${encodeURIComponent(third)}&to=${encodeURIComponent(all.body.data[0].arrivedAt)}`,
    )
    expect(ids(range)).toEqual([29, 28])
  })

  it('sorts unscored items first in ascending score order and breaks ties by ID, newest first', async () => {
    useScenario('quarantine-mailbox-user')
    const ascending = await call('GET', '/quarantine?sort=score&order=asc&limit=100')
    expect(ids(ascending)[0]).toBe(QUARANTINE_ITEM.noScoreNoSubject)
    const bySubject = await call('GET', '/quarantine?sort=subject&limit=3')
    expect(bySubject.body.data[0].subject).toBe('')
  })
})

describe('getQuarantineItem', () => {
  it('answers 404 outside the scope and hides attachments without the flag', async () => {
    useScenario('quarantine-admin', { signedInAs: 'alice@example.org' })
    expect((await call('GET', '/quarantine/31')).status).toBe(404)
    useScenario('quarantine-user-no-attachments')
    const item = await call('GET', `/quarantine/${QUARANTINE_ITEM.virus}`)
    expect(item.body.data.content.attachments).toBeNull()
    expect(item.body.data).not.toHaveProperty('authenticatedSender')
    expect(item.headers.get('etag')).toBe(item.body.data.etag)
  })

  it('reports too large and missing content, and gives administrators the authenticated sender', async () => {
    useScenario('quarantine-admin')
    const large = await call('GET', `/quarantine/${QUARANTINE_ITEM.tooLarge}`)
    expect(large.body.data).toMatchObject({ contentStatus: 'tooLarge', content: null })
    expect(large.body.data).toHaveProperty('authenticatedSender')
    const missing = await call('GET', `/quarantine/${QUARANTINE_ITEM.missing}`)
    expect(missing.body.data.contentStatus).toBe('missing')
    const virus = await call('GET', `/quarantine/${QUARANTINE_ITEM.virus}`)
    expect(virus.body.data.content.attachments).toHaveLength(2)
    expect(virus.body.data.content.attachments[0].sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('item actions', () => {
  it('releases with and without learning, with the step report, and removes the item', async () => {
    useScenario('quarantine-mailbox-user')
    const released = await call('POST', '/quarantine/1/release', { body: {} })
    expect(released.status).toBe(200)
    expect(released.body.data).toMatchObject({
      action: 'release',
      delivery: 'done',
      learning: 'done',
      fuzzy: 'done',
      itemRemoved: true,
    })
    expect((await call('GET', '/quarantine/1')).status).toBe(404)
    const quick = await call('POST', '/quarantine/2/release', { body: { learnAsHam: false } })
    expect(quick.body.data).toMatchObject({
      action: 'releaseWithoutLearning',
      learning: 'notRequested',
      fuzzy: 'notRequested',
    })
  })

  it('reports a failed learning as a done delivery, and keeps an item whose spam learning fails', async () => {
    const state = useScenario('quarantine-mailbox-user')
    state.quarantine.items.find((item) => item.id === 3)!.inject = { learning: 'failed' }
    const released = await call('POST', '/quarantine/3/release')
    expect(released.body.data).toMatchObject({
      delivery: 'done',
      learning: 'failed',
      fuzzy: 'notRequested',
    })
    expect(released.body.data.learningError).toEqual(expect.any(String))
    state.quarantine.items.find((item) => item.id === 4)!.inject = { learning: 'failed' }
    const learned = await call('POST', '/quarantine/4/spam-learning')
    expect(learned.status).toBe(503)
    expect(learned.body).toMatchObject({ dependency: 'spamFilter', step: 'learning' })
    expect((await call('GET', '/quarantine/4')).status).toBe(200)
  })

  it('answers busy with Retry-After once, then the item is gone', async () => {
    useScenario('quarantine-busy')
    const busy = await call('POST', '/quarantine/1/release')
    expect(busy.status).toBe(409)
    expect(busy.headers.get('retry-after')).toBe('5')
    expect(busy.body.type).toBe('/api/v2/problems/quarantine-item-busy')
    expect((await call('GET', '/quarantine/1')).status).toBe(404)
  })

  it('keeps an item whose delivery is refused, with the mail server answer', async () => {
    const state = useScenario('quarantine-mailbox-user')
    state.quarantine.items.find((item) => item.id === 5)!.inject = { deliveryRefused: {} }
    const refused = await call('POST', '/quarantine/5/release')
    expect(refused.status).toBe(409)
    expect(refused.body).toMatchObject({ smtpCode: 550 })
    expect(refused.body.smtpResponse).toContain('‮')
  })

  it('checks If-Match, the quarantine flag, and deletes with 204', async () => {
    useScenario('quarantine-mailbox-user')
    expect((await call('DELETE', '/quarantine/7', { ifMatch: '"other"' })).status).toBe(412)
    const item = await call('GET', '/quarantine/7')
    expect((await call('DELETE', '/quarantine/7', { ifMatch: item.body.data.etag })).status).toBe(
      204,
    )
    useScenario('quarantine-user-no-actions')
    const refused = await call('DELETE', '/quarantine/8')
    expect(refused.status).toBe(403)
    expect(refused.body).toMatchObject({ requiredFlags: ['quarantine'] })
  })

  it('writes an audit record of each action, without the subject', async () => {
    const state = useScenario('quarantine-mailbox-user')
    await call('POST', '/quarantine/1/release')
    const record = state.auditEvents.at(-1)!
    expect(record).toMatchObject({
      eventType: 'quarantineItemRelease',
      target: { type: 'quarantineItem', id: '1' },
      details: { recipient: 'alice@example.org', action: 'release' },
    })
    expect(JSON.stringify(record.details)).not.toContain('invoice')
  })
})

describe('applyQuarantineBulkAction', () => {
  it('gives one result per distinct item with the outcome of each injection', async () => {
    useScenario('quarantine-bulk-failures')
    const list = await call('GET', '/quarantine?limit=50')
    const targets = (list.body.data as { id: number; etag: string }[]).map((item) => ({
      id: String(item.id),
      version: item.etag,
    }))
    const answer = await call('POST', '/quarantine/bulk-actions', {
      body: { action: 'release', targets: [...targets, targets[0]] },
    })
    expect(answer.status).toBe(200)
    const outcome = (id: number) =>
      (answer.body.data.results as { id: string; outcome: string }[]).find(
        (result) => result.id === String(id),
      )
    expect(answer.body.data.results).toHaveLength(50)
    expect(outcome(BULK_FAILURE_ITEM.removedElsewhere)?.outcome).toBe('notFound')
    expect(outcome(BULK_FAILURE_ITEM.busy)?.outcome).toBe('refused')
    expect(outcome(BULK_FAILURE_ITEM.deliveryRefused)?.outcome).toBe('refused')
    expect(outcome(BULK_FAILURE_ITEM.temporaryFailure)?.outcome).toBe('failed')
    expect(outcome(BULK_FAILURE_ITEM.outdated)?.outcome).toBe('outdated')
    expect(outcome(BULK_FAILURE_ITEM.learningFailed)).toMatchObject({
      outcome: 'done',
      report: { learning: 'failed' },
    })
    expect(answer.body.data.summary).toEqual({
      total: 50,
      done: 45,
      notFound: 1,
      refused: 2,
      outdated: 1,
      failed: 1,
    })
  })

  it('refuses more targets than the bulk limit, and the whole request without the flag', async () => {
    useScenario('quarantine-low-bulk-limit')
    const targets = Array.from({ length: 11 }, (_, index) => ({ id: String(101 + index) }))
    const tooMany = await call('POST', '/quarantine/bulk-actions', {
      body: { action: 'delete', targets },
    })
    expect(tooMany.status).toBe(422)
    expect(tooMany.body.errors.targets[0]).toMatchObject({ code: 'tooMany', params: { max: 10 } })
    useScenario('quarantine-domain-admin-no-actions')
    const refused = await call('POST', '/quarantine/bulk-actions', {
      body: { action: 'delete', targets: [{ id: '101' }] },
    })
    expect(refused.status).toBe(403)
  })
})

describe('downloads', () => {
  it('saves an attachment and the message with the four headers', async () => {
    useScenario('quarantine-mailbox-user')
    const attachment = await call('GET', `/quarantine/${QUARANTINE_ITEM.attachments}/attachments/1`)
    expect(attachment.status).toBe(200)
    expect(attachment.headers.get('content-type')).toBe('application/octet-stream')
    expect(attachment.headers.get('content-disposition')).toContain('filename="data.csv"')
    expect(new TextDecoder().decode(attachment.bytes)).toBe('a,b,c\n1,2,3\n')
    const message = await call('GET', `/quarantine/${QUARANTINE_ITEM.attachments}/message`)
    expect(message.headers.get('content-type')).toBe('message/rfc822')
    expect(message.headers.get('x-content-type-options')).toBe('nosniff')
    expect(message.headers.get('cache-control')).toBe('private, no-store')
    expect((await call('GET', '/quarantine/6/attachments/9')).status).toBe(404)
  })

  it('refuses too large messages and missing flags, quarantine first', async () => {
    useScenario('quarantine-mailbox-user')
    const large = await call('GET', `/quarantine/${QUARANTINE_ITEM.tooLarge}/message`)
    expect(large.status).toBe(409)
    expect(large.body).toMatchObject({ size: 12 * 1_048_576, limit: 10 * 1_048_576 })
    useScenario('quarantine-user-no-flags')
    const message = await call('GET', '/quarantine/6/message')
    expect(message.body.requiredFlags).toEqual(['quarantine'])
    useScenario('quarantine-user-no-attachments')
    expect((await call('GET', '/quarantine/6/message')).body.requiredFlags).toEqual([
      'quarantineAttachments',
    ])
    expect((await call('GET', '/quarantine/6/attachments/0')).status).toBe(403)
  })
})

describe('settings', () => {
  it('gives administrators every value and others the public subset', async () => {
    useScenario('quarantine-admin')
    const full = await call('GET', '/quarantine/settings')
    expect(full.body.data).toMatchObject({
      visibility: 'full',
      active: true,
      retentionPerMailbox: 20,
      maxMessageSize: 15 * 1_048_576,
      maxAgeDays: 365,
      notificationSender: 'quarantine@localhost',
      notificationSenderIsDefault: true,
      notificationTemplateIsDefault: true,
    })
    useScenario('quarantine-mailbox-user')
    const subset = await call('GET', '/quarantine/settings')
    expect(Object.keys(subset.body.data).sort()).toEqual([
      'active',
      'etag',
      'maxMessageSize',
      'retentionPerMailbox',
      'visibility',
    ])
    expect((await call('PATCH', '/quarantine/settings', { body: { maxAgeDays: 2 } })).status).toBe(
      403,
    )
  })

  it('applies a merge patch, refuses invalid values with rule codes, and restores defaults', async () => {
    useScenario('quarantine-admin')
    const read = await call('GET', '/quarantine/settings')
    const invalid = await call('PATCH', '/quarantine/settings', {
      ifMatch: read.body.data.etag,
      body: {
        maxMessageSize: 1000,
        copyRecipient: 'not-an-address',
        excludedDomains: ['example.com', 'nowhere.example'],
        notificationTemplate: '{% for x in meta %}',
      },
    })
    expect(invalid.status).toBe(422)
    expect(Object.keys(invalid.body.errors).sort()).toEqual([
      'copyRecipient',
      'excludedDomains.1',
      'maxMessageSize',
      'notificationTemplate',
    ])
    expect(invalid.body.errors.notificationTemplate[0]).toMatchObject({
      code: 'invalidTemplate',
      params: { reason: 'syntax', line: 1 },
    })
    const saved = await call('PATCH', '/quarantine/settings', {
      ifMatch: read.body.data.etag,
      body: { notificationTemplate: '<p>{{ username }}</p>', copyRecipient: 'copy@example.org' },
    })
    expect(saved.status).toBe(200)
    expect(saved.body.data).toMatchObject({
      notificationTemplateIsDefault: false,
      copyRecipient: 'copy@example.org',
    })
    expect(
      (
        await call('PATCH', '/quarantine/settings', {
          ifMatch: read.body.data.etag,
          body: { maxAgeDays: 9 },
        })
      ).status,
    ).toBe(412)
    const restored = await call('PATCH', '/quarantine/settings', {
      body: { notificationTemplate: null },
    })
    expect(restored.body.data.notificationTemplateIsDefault).toBe(true)
  })
})

describe('notification settings', () => {
  it('reads and changes a mailbox user’s own settings, refusing a member without its flag', async () => {
    const state = useScenario('quarantine-user-no-flags')
    state.quarantine.noCategory = ['alice@example.org']
    const read = await call('GET', '/mailboxes/alice@example.org/quarantine-notification-settings')
    expect(read.body.data).toMatchObject({ mailbox: 'alice@example.org', category: null })
    const refused = await call(
      'PATCH',
      '/mailboxes/alice@example.org/quarantine-notification-settings',
      { body: { frequency: 'daily' } },
    )
    expect(refused.status).toBe(403)
    expect(refused.body).toMatchObject({
      attributes: ['frequency'],
      requiredFlags: { frequency: 'quarantineNotification' },
    })
    const same = await call(
      'PATCH',
      '/mailboxes/alice@example.org/quarantine-notification-settings',
      { body: { frequency: read.body.data.frequency } },
    )
    expect(same.status).toBe(200)
    expect(
      (await call('GET', '/mailboxes/bob@example.org/quarantine-notification-settings')).status,
    ).toBe(404)
  })

  it('sets values for many mailboxes, reporting mailboxes outside the scope as not found', async () => {
    useScenario('quarantine-domain-admin')
    const answer = await call('POST', '/quarantine-notification-settings/bulk-actions', {
      body: {
        frequency: 'weekly',
        targets: [{ id: 'anna@example.org' }, { id: 'gina@other.example' }],
      },
    })
    expect(answer.body.data.summary).toMatchObject({ done: 1, notFound: 1 })
    const mailbox = await call('GET', '/mailboxes/anna@example.org')
    expect(mailbox.body.data.quarantineNotification).toBe('weekly')
    useScenario('quarantine-mailbox-user')
    expect(
      (
        await call('POST', '/quarantine-notification-settings/bulk-actions', {
          body: { frequency: 'weekly', targets: [{ id: 'alice@example.org' }] },
        })
      ).status,
    ).toBe(403)
  })
})

describe('capabilities', () => {
  it('answer the spec defaults and a scenario’s lower bulk limit', async () => {
    useScenario('quarantine-mailbox-user')
    const answer = await call('GET', '/capabilities/quarantine')
    expect(answer.body.data).toMatchObject({
      bulkLimit: 100,
      defaultPageSize: 25,
      contentSizeLimit: 10 * 1_048_576,
      spamScore: { min: 0, max: 5000, step: 0.1 },
      senderPattern: { maxLength: 100, allowedCharacters: 'a-z0-9@_.*-' },
    })
    useScenario('quarantine-low-bulk-limit')
    expect((await call('GET', '/capabilities/quarantine')).body.data.bulkLimit).toBe(10)
  })
})

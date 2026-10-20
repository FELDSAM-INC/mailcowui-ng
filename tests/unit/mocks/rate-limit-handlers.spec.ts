// The UI 006 rate limit handlers (T097): limits stored on the domains, alias domains and mailboxes,
// the effective mailbox limit, invalid stored values, the overview and the bucket reset.
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

describe('rate limits of one object', () => {
  it("show a mailbox the domain's limit until it has its own, and the domain page sees changes", async () => {
    useScenario('quarantine-domain-admin')
    const mailbox = await call('GET', '/mailboxes/alice@example.org/rate-limit')
    expect(mailbox.body.data).toMatchObject({
      limit: null,
      effectiveLimit: { value: 100, frame: 'hour' },
      effectiveSource: 'domain',
    })
    const set = await call('PUT', '/mailboxes/alice@example.org/rate-limit', {
      ifMatch: mailbox.body.data.etag,
      body: { value: 10, frame: 'minute' },
    })
    expect(set.body.data).toMatchObject({
      limit: { value: 10, frame: 'minute' },
      effectiveSource: 'mailbox',
    })
    expect(
      (
        await call('DELETE', '/mailboxes/alice@example.org/rate-limit', {
          ifMatch: mailbox.body.data.etag,
        })
      ).status,
    ).toBe(412)
    expect(
      (
        await call('DELETE', '/mailboxes/alice@example.org/rate-limit', {
          ifMatch: set.body.data.etag,
        })
      ).status,
    ).toBe(204)
    await call('PUT', '/domains/example.com/rate-limit', { body: { value: 5, frame: 'second' } })
    const domain = await call('GET', '/domains/example.com')
    expect(domain.body.data.rateLimit).toEqual({ value: 5, frame: 'second' })
  })

  it('report an invalid stored value, accept removing an unset limit, and need the ratelimit flag', async () => {
    const state = useScenario('quarantine-domain-admin', {
      quarantine: { invalidRateLimits: { 'aliasDomain:example.net': '10 per hour' } },
    })
    const alias = await call('GET', '/alias-domains/example.net/rate-limit')
    expect(alias.body.data).toMatchObject({ limit: null, invalidStoredValue: '10 per hour' })
    expect((await call('DELETE', '/domains/example.com/rate-limit')).status).toBe(204)
    expect(state.auditEvents.filter((event) => event.eventType === 'rateLimitRemoval')).toEqual([])
    state.accounts.find((account) => account.username === 'reseller')!.permissions.ratelimit = false
    expect((await call('GET', '/domains/example.org/rate-limit')).status).toBe(200)
    const refused = await call('PUT', '/domains/example.org/rate-limit', {
      body: { value: 5, frame: 'hour' },
    })
    expect(refused.body).toMatchObject({ requiredFlags: ['ratelimit'] })
    useScenario('quarantine-mailbox-user')
    expect((await call('GET', '/mailboxes/alice@example.org/rate-limit')).status).toBe(403)
  })
})

describe('listRateLimits', () => {
  it('lists the limits in scope with the kind filter, search, sort and paging', async () => {
    useScenario('quarantine-admin', {
      quarantine: {
        rateLimits: {
          domain: { 'example.com': { value: 1, frame: 'day' } },
          aliasDomain: { 'example.net': { value: 2, frame: 'minute' } },
          mailbox: {
            'alice@example.org': { value: 3, frame: 'second' },
            'gina@other.example': { value: 4, frame: 'hour' },
          },
        },
      },
    })
    const all = await call('GET', '/rate-limits')
    expect((all.body.data as { object: string }[]).map((item) => item.object)).toEqual([
      'alice@example.org',
      'example.com',
      'example.net',
      'example.org',
      'gina@other.example',
    ])
    const mailboxes = await call('GET', '/rate-limits?kind=mailbox')
    expect(mailboxes.body.meta.total).toBe(2)
    const byKind = await call('GET', '/rate-limits?sort=kind&q=example')
    expect((byKind.body.data as { kind: string }[]).map((item) => item.kind)).toEqual([
      'domain',
      'domain',
      'aliasDomain',
      'mailbox',
      'mailbox',
    ])
    useScenario('quarantine-domain-admin', {
      quarantine: {
        rateLimits: { mailbox: { 'gina@other.example': { value: 4, frame: 'hour' } } },
      },
    })
    expect(
      ((await call('GET', '/rate-limits')).body.data as { object: string }[]).map(
        (item) => item.object,
      ),
    ).toEqual(['example.org'])
  })
})

describe('resetRateLimitBucket', () => {
  it('removes matching operations log entries and records the reset in history', async () => {
    const state = useScenario('ops-rate-limits')
    const entries = state.operations.logs.entries['rate-limits']
    const bucketId = entries.find((entry) => entry.rateLimitHash)!.rateLimitHash!
    const removed = entries.filter((entry) => entry.rateLimitHash === bucketId).length
    state.quarantine.buckets.push(bucketId)
    expect(
      (await call('DELETE', `/rate-limit-buckets/${encodeURIComponent(bucketId)}`)).status,
    ).toBe(204)
    expect(state.operations.logs.entries['rate-limits']).toHaveLength(entries.length - removed)
    expect(state.quarantine.buckets).not.toContain(bucketId)
    expect(
      state.auditEvents.find((event) => event.eventType === 'rateLimitBucketReset'),
    ).toMatchObject({
      target: { type: 'rateLimitBucket', id: bucketId },
      details: { countersExisted: true, logEntriesRemoved: removed },
    })
    expect(
      (await call('DELETE', `/rate-limit-buckets/${encodeURIComponent(bucketId)}`)).status,
    ).toBe(404)
  })

  it('resets a known bucket once, answers 404 for an unknown one, and refuses non-administrators', async () => {
    useScenario('quarantine-admin')
    expect((await call('DELETE', '/rate-limit-buckets/RLabc=')).status).toBe(204)
    expect((await call('DELETE', '/rate-limit-buckets/RLabc=')).status).toBe(404)
    useScenario('quarantine-domain-admin')
    expect((await call('DELETE', '/rate-limit-buckets/RLabc=')).status).toBe(403)
  })
})

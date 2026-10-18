// The sync-job mock handlers (UI 008 T013, research R20): every response passes the contract
// validator (the setup file fails a test on any violation), each documented behaviour of API 008
// holds, and the remote password never appears in a response.
import { describe, expect, it } from 'vitest'

import { syncJobEtag } from '../../mocks/factories/sync-job'
import { useScenario } from '../../mocks/node'
import { applyOverrides, type ScenarioState } from '../../mocks/scenarios'

const api = (path: string) => `${location.origin}/api/v2${path}`

interface Answer {
  status: number
  headers: Headers
  text: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
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
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    text,
    body: text ? JSON.parse(text) : undefined,
  }
}

const ids = (answer: Answer) => (answer.body.data as { id: number }[]).map((job) => job.id)
const job = (state: ScenarioState, id: number) =>
  state.syncJobs.jobs.find((item) => item.id === id)!

const minimal = {
  mailbox: 'dora@example.org',
  remoteHost: 'imap.new.example',
  remotePort: 993,
  remoteUser: 'dora.remote',
  remotePassword: 'Marker-Secret-1',
}

describe('sync-job handlers: scope and flags', () => {
  it('refuses callers without the syncjobs flag before any lookup', async () => {
    useScenario('sync-jobs-domain-admin-no-flag')
    for (const [method, path] of [
      ['GET', '/sync-jobs'],
      ['GET', '/sync-jobs/999999'],
      ['GET', '/capabilities/sync-jobs'],
      ['GET', '/sync-jobs/2/log'],
    ] as const) {
      const answer = await call(method, path)
      expect(answer.status).toBe(403)
      expect(answer.body.type).toBe('/api/v2/problems/permission-flag-required')
      expect(answer.body.requiredFlags).toEqual(['syncjobs'])
    }
    useScenario('sync-jobs-user-no-flag')
    expect((await call('POST', '/sync-jobs/1/schedule-reset')).status).toBe(403)
  })

  it('scopes the list per role and answers 404 outside the scope', async () => {
    useScenario('sync-jobs-domain-admin')
    const list = await call('GET', '/sync-jobs?limit=100')
    expect(
      list.body.data.every((item: { mailbox: string }) => item.mailbox.endsWith('@example.org')),
    ).toBe(true)
    expect((await call('GET', '/sync-jobs/3')).status).toBe(404)
    useScenario('sync-jobs-user')
    expect(ids(await call('GET', '/sync-jobs'))).toEqual([1, 2])
    expect((await call('GET', '/sync-jobs/3')).status).toBe(404)
    expect((await call('GET', '/sync-jobs/3/log')).status).toBe(404)
  })
})

describe('sync-job handlers: list', () => {
  it('searches, filters, sorts with ties by id and pages', async () => {
    useScenario('sync-jobs-admin')
    const all = await call('GET', '/sync-jobs?limit=100')
    expect(all.body.meta).toEqual({ total: 60, limit: 100, offset: 0 })
    expect(ids(all).slice(0, 3)).toEqual([1, 2, 3])
    const desc = await call('GET', '/sync-jobs?sort=id&order=desc&limit=2&offset=1')
    expect(ids(desc)).toEqual([59, 58])
    expect(ids(await call('GET', '/sync-jobs?q=previous'))).toEqual([2])
    expect(ids(await call('GET', '/sync-jobs?q=ALICE.old'))).toEqual([1])
    const carol = await call('GET', '/sync-jobs?mailbox=Carol@Example.net&limit=100')
    expect(
      carol.body.data.every((item: { mailbox: string }) => item.mailbox === 'carol@example.net'),
    ).toBe(true)
    const net = await call('GET', '/sync-jobs?domain=EXAMPLE.NET&limit=100')
    expect(net.body.data.every((item: { mailbox: string }) => item.mailbox.endsWith('.net'))).toBe(
      true,
    )
    const inactive = await call('GET', '/sync-jobs?active=false&limit=100')
    expect(inactive.body.data.every((item: { active: boolean }) => !item.active)).toBe(true)
    expect(ids(await call('GET', '/sync-jobs?running=true'))).toEqual([4, 5])
    const unknown = await call('GET', '/sync-jobs?lastResult=unknown&limit=100')
    expect(ids(unknown)).toContain(1)
    expect(ids(unknown)).toContain(15)
    const failed = await call('GET', '/sync-jobs?lastResult=failed&limit=100')
    expect(
      failed.body.data.every(
        (item: { runStatus: { lastResult: string } }) => item.runStatus.lastResult === 'failed',
      ),
    ).toBe(true)
  })

  it('accepts every sort key, breaking ties by id', async () => {
    useScenario('sync-jobs-admin')
    for (const sort of [
      'id',
      'mailbox',
      'remoteHost',
      'remoteUser',
      'intervalMinutes',
      'active',
      'lastRunAt',
      'lastResult',
      'createdAt',
      'modifiedAt',
    ]) {
      const answer = await call('GET', `/sync-jobs?sort=${sort}&limit=100`)
      expect(answer.status).toBe(200)
    }
    const byActive = await call('GET', '/sync-jobs?sort=active&limit=100')
    const firstActive = byActive.body.data.findIndex((item: { active: boolean }) => item.active)
    const inactiveIds = ids(byActive).slice(0, firstActive)
    expect(inactiveIds).toEqual([...inactiveIds].sort((a, b) => a - b))
    const byRun = await call('GET', '/sync-jobs?sort=lastRunAt&limit=100')
    expect(byRun.body.data[0].runStatus.lastRunAt).toBeNull()
  })
})

describe('sync-job handlers: create and update', () => {
  it('creates with defaults, Location and ETag, and keeps the password out of the answer', async () => {
    const state = useScenario('sync-jobs-admin')
    const answer = await call('POST', '/sync-jobs', { body: minimal })
    expect(answer.status).toBe(201)
    expect(answer.headers.get('Location')).toBe(`/api/v2/sync-jobs/${answer.body.data.id}`)
    expect(answer.headers.get('ETag')).toBe(answer.body.data.etag)
    expect(answer.body.data).toMatchObject({
      exclude: '(?i)spam|(?i)junk',
      intervalMinutes: 20,
      remotePasswordSet: true,
    })
    expect(answer.text).not.toContain('Marker-Secret-1')
    expect(job(state, answer.body.data.id).remotePassword).toBe('Marker-Secret-1')
  })

  it("targets the mailbox user's own mailbox and refuses another one with 404", async () => {
    useScenario('sync-jobs-user')
    const own = await call('POST', '/sync-jobs', { body: { ...minimal, mailbox: undefined } })
    expect(own.body.data.mailbox).toBe('alice@example.org')
    expect(
      (await call('POST', '/sync-jobs', { body: { ...minimal, remoteUser: 'x2' } })).status,
    ).toBe(404)
  })

  it('reports each rule with its parameters', async () => {
    useScenario('sync-jobs-admin')
    const bad = await call('POST', '/sync-jobs', {
      body: {
        ...minimal,
        remoteHost: '2001:db8::1',
        exclude: '(?i)spam|(junk',
        customParameters: '--maxsize 100 --showpasswords',
      },
    })
    expect(bad.status).toBe(422)
    expect(bad.body.errors.remoteHost[0]).toMatchObject({
      code: 'invalidFormat',
      params: { format: 'hostName' },
    })
    expect(bad.body.errors.exclude[0].code).toBe('invalidRegex')
    const codes = bad.body.errors.customParameters.map((item: { code: string }) => item.code)
    expect(codes).toEqual(expect.arrayContaining(['optionContainsSpace', 'optionNotAllowed']))
    const malformed = await call('POST', '/sync-jobs', {
      body: { ...minimal, remoteHost: 'bad_host!.example' },
    })
    expect(malformed.body.errors.remoteHost[0].params.format).toBe('hostName')
    const resource = await call('POST', '/sync-jobs', {
      body: { ...minimal, mailbox: 'room1@example.org' },
    })
    expect(resource.body.errors.mailbox[0]).toMatchObject({
      code: 'notEligible',
      params: { kind: 'resource' },
    })
    const alias = await call('POST', '/sync-jobs', {
      body: { ...minimal, mailbox: 'info@example.org' },
    })
    expect(alias.body.errors.mailbox[0].params.kind).toBe('alias')
    expect(
      (await call('POST', '/sync-jobs', { body: { ...minimal, mailbox: 'nobody@example.org' } }))
        .status,
    ).toBe(404)
  })

  it('refuses custom parameters to non-administrators when the server restricts them', async () => {
    useScenario('sync-jobs-user-restricted-params')
    const caps = await call('GET', '/capabilities/sync-jobs')
    expect(caps.body.data.customParameters).toMatchObject({
      allowed: false,
      restrictedToAdministrators: true,
    })
    const refused = await call('POST', '/sync-jobs', {
      body: { ...minimal, mailbox: undefined, customParameters: '--maxsize=1' },
    })
    expect(refused.body.errors.customParameters[0].code).toBe('customParamsNotPermitted')
    const read = await call('GET', '/sync-jobs/1')
    const kept = await call('PATCH', '/sync-jobs/1', {
      body: { customParameters: read.body.data.customParameters, dryRun: true },
      ifMatch: read.body.data.etag,
    })
    expect(kept.status).toBe(200)
  })

  it('answers 409 sync-job-exists for a case-insensitive duplicate', async () => {
    useScenario('sync-jobs-admin')
    const answer = await call('POST', '/sync-jobs', {
      body: {
        ...minimal,
        mailbox: 'ALICE@example.org',
        remoteHost: 'Mail.Previous.Example',
        remoteUser: 'ALICE',
      },
    })
    expect(answer.status).toBe(409)
    expect(answer.body).toMatchObject({ type: '/api/v2/problems/sync-job-exists', syncJobId: 2 })
  })

  it('updates with If-Match, keeps the password on an empty value and refuses another mailbox', async () => {
    const state = useScenario('sync-jobs-admin')
    const read = await call('GET', '/sync-jobs/2')
    expect(read.headers.get('ETag')).toBe(read.body.data.etag)
    const stale = await call('PATCH', '/sync-jobs/2', {
      body: { intervalMinutes: 30 },
      ifMatch: '"old"',
    })
    expect(stale.status).toBe(412)
    const empty = await call('PATCH', '/sync-jobs/2', {
      body: { remotePassword: '' },
      ifMatch: read.body.data.etag,
    })
    expect(empty.body.data.etag).toBe(read.body.data.etag)
    expect(job(state, 2).remotePassword).toBe('remote-secret-2')
    const changed = await call('PATCH', '/sync-jobs/2', {
      body: { intervalMinutes: 30, remotePassword: 'New-Secret' },
      ifMatch: read.body.data.etag,
    })
    expect(changed.status).toBe(200)
    expect(changed.body.data.etag).not.toBe(read.body.data.etag)
    expect(changed.text).not.toContain('New-Secret')
    const immutable = await call('PATCH', '/sync-jobs/2', {
      body: { mailbox: 'dora@example.org' },
      ifMatch: changed.body.data.etag,
    })
    expect(immutable.body.errors.mailbox[0].code).toBe('immutable')
    const same = await call('PATCH', '/sync-jobs/2', {
      body: { mailbox: 'alice@example.org', active: false },
      ifMatch: changed.body.data.etag,
    })
    expect(same.status).toBe(200)
    const duplicate = await call('PATCH', '/sync-jobs/2', {
      body: { remoteHost: 'imap.old-mail.example', remoteUser: 'alice.old' },
      ifMatch: same.body.data.etag,
    })
    expect(duplicate.body.syncJobId).toBe(1)
  })
})

describe('sync-job handlers: reschedule, delete, bulk, log, capabilities', () => {
  it('reschedules without changing the version and deletes with 204', async () => {
    const state = useScenario('sync-jobs-admin')
    const before = syncJobEtag(job(state, 2))
    const answer = await call('POST', '/sync-jobs/2/schedule-reset')
    expect(answer.body.data.runStatus).toMatchObject({ lastRunAt: null, lastResult: 'unknown' })
    expect(answer.body.data.etag).toBe(before)
    expect((await call('DELETE', '/sync-jobs/2', { ifMatch: '"x"' })).status).toBe(412)
    expect((await call('DELETE', '/sync-jobs/2', { ifMatch: before })).status).toBe(204)
    expect((await call('GET', '/sync-jobs/2')).status).toBe(404)
  })

  it('answers each bulk target in request order, once', async () => {
    const state = useScenario('sync-jobs-bulk')
    const v = (id: number) => syncJobEtag(job(state, id)).replace(/"/g, '')
    const answer = await call('POST', '/sync-jobs/bulk-actions', {
      body: {
        action: 'activate',
        targets: [
          { id: '2', version: v(2) },
          { id: '7', version: v(7) },
          { id: '4', version: 'stale' },
          { id: '999', version: 'x' },
          { id: '2', version: v(2) },
        ],
      },
    })
    expect(
      answer.body.data.results.map((item: { id: string; outcome: string }) => [
        item.id,
        item.outcome,
      ]),
    ).toEqual([
      ['2', 'done'],
      ['7', 'failed'],
      ['4', 'outdated'],
      ['999', 'notFound'],
    ])
    expect(job(state, 2).active).toBe(true)
    const reschedule = await call('POST', '/sync-jobs/bulk-actions', {
      body: { action: 'reschedule', targets: [{ id: '4', version: 'stale' }] },
    })
    expect(reschedule.body.data.results[0].outcome).toBe('done')
    const remove = await call('POST', '/sync-jobs/bulk-actions', {
      body: { action: 'delete', targets: [{ id: '3', version: v(3) }] },
    })
    expect(remove.body.data.results[0]).toEqual({ id: '3', outcome: 'done' })
    applyOverrides(state, { syncJobs: { capabilities: { bulkLimit: 2 } } })
    const tooMany = await call('POST', '/sync-jobs/bulk-actions', {
      body: { action: 'activate', targets: [{ id: '1' }, { id: '5' }, { id: '6' }] },
    })
    expect(tooMany.status).toBe(422)
    expect(tooMany.body.errors.targets[0]).toMatchObject({ code: 'tooMany', params: { max: 2 } })
  })

  it('returns the log, the capabilities and follows the runtime changes', async () => {
    const state = useScenario('sync-jobs-running')
    const log = await call('GET', '/sync-jobs/2/log')
    expect(log.body.data).toMatchObject({ syncJobId: 2, runStatus: { running: true } })
    expect(log.body.data.log).toContain('Host1')
    expect(log.text).not.toContain('remote-secret')
    expect((await call('GET', '/capabilities/sync-jobs')).body.data.bulkLimit).toBe(100)
    const etag = syncJobEtag(job(state, 2))
    applyOverrides(state, {
      syncJobs: { finishRun: { id: 2, lastResult: 'succeeded', exitStatus: 'EX_OK' } },
    })
    expect(job(state, 2).runStatus).toMatchObject({
      running: false,
      lastResult: 'succeeded',
      exitStatus: 'EX_OK',
    })
    expect(syncJobEtag(job(state, 2))).toBe(etag)
    applyOverrides(state, { syncJobs: { startRun: 3 } })
    expect(job(state, 3).runStatus.running).toBe(true)
    applyOverrides(state, { syncJobs: { changeElsewhere: { id: 1, intervalMinutes: 45 } } })
    expect(job(state, 1).intervalMinutes).toBe(45)
    applyOverrides(state, {
      syncJobs: { renameMailbox: { from: 'dora@example.org', to: 'dora.new@example.org' } },
    })
    expect(job(state, 2).mailbox).toBe('dora.new@example.org')
    applyOverrides(state, { syncJobs: { delete: 1 } })
    expect((await call('GET', '/sync-jobs/1')).status).toBe(404)
  })
})

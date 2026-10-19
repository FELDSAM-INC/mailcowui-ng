// The mailbox template write handlers (UI 003 US7, T102): every response passes the contract
// validator (the setup file fails a test on any violation), and the documented behaviour of
// createMailboxTemplate, updateMailboxTemplate, deleteMailboxTemplate and the bulk removal (G39)
// holds.
import { describe, expect, it } from 'vitest'

import { GIB } from '../../mocks/factories/domain'
import { mockMailboxTemplate } from '../../mocks/factories/mailbox-template'
import { useScenario } from '../../mocks/node'
import type { ScenarioState } from '../../mocks/scenarios/state'

const api = (path: string) => `${location.origin}/api/v2${path}`

interface Answer {
  status: number
  headers: Headers
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
    body: text ? JSON.parse(text) : undefined,
  }
}

/** Default, Small and Staff, signed in as the administrator unless told otherwise. */
function seed(signedInAs = 'admin'): ScenarioState {
  const state = useScenario('admin-active', { signedInAs })
  state.mailboxTemplates.push(
    mockMailboxTemplate({ id: 2, name: 'Small', quota: GIB }),
    mockMailboxTemplate({ id: 3, name: 'Staff', tags: ['staff'] }),
  )
  return state
}

const names = (state: ScenarioState) => state.mailboxTemplates.map((item) => item.name)

describe('createMailboxTemplate', () => {
  it('gives omitted values the template defaults and answers 201 with Location and ETag', async () => {
    const state = seed()
    state.mailboxCapabilities.templateDefaults.quarantineNotification = 'daily'
    const answer = await call('POST', '/mailbox-templates', {
      body: { name: '  Sales  ', quota: 2 * GIB, protocolAccess: { pop3: false } },
    })
    expect(answer.status).toBe(201)
    expect(answer.body.data).toMatchObject({
      id: 4,
      name: 'Sales',
      quota: 2 * GIB,
      isDefault: false,
      quarantineNotification: 'daily',
      protocolAccess: { pop3: false, imap: true },
      modifiedAt: null,
    })
    expect(answer.headers.get('location')).toBe('/api/v2/mailbox-templates/4')
    expect(answer.headers.get('etag')).toBe(answer.body.data.etag)
    expect(names(state)).toContain('Sales')
  })

  it('refuses a name in use in any letter case, and an empty name', async () => {
    seed()
    const taken = await call('POST', '/mailbox-templates', { body: { name: 'sMALL' } })
    expect(taken.status).toBe(409)
    expect(taken.body.type).toBe('/api/v2/problems/mailbox-template-name-exists')
    const empty = await call('POST', '/mailbox-templates', { body: { name: '  ' } })
    expect(empty.status).toBe(422)
    expect(empty.body.errors.name[0].code).toBe('required')
  })

  it('answers 403 to a domain administrator', async () => {
    seed('reseller')
    expect((await call('POST', '/mailbox-templates', { body: { name: 'X' } })).status).toBe(403)
  })
})

describe('updateMailboxTemplate', () => {
  it('merges nested members, replaces tags, removes the rate limit and sends a new ETag', async () => {
    const state = seed()
    state.mailboxTemplates[2]!.rateLimit = { value: 10, frame: 'hour' }
    const before = await call('GET', '/mailbox-templates/3')
    const answer = await call('PATCH', '/mailbox-templates/3', {
      ifMatch: before.headers.get('etag')!,
      body: { protocolAccess: { smtp: false }, tags: ['a', 'b'], rateLimit: null },
    })
    expect(answer.status).toBe(200)
    expect(answer.body.data).toMatchObject({
      protocolAccess: { smtp: false, imap: true },
      tags: ['a', 'b'],
      rateLimit: null,
    })
    expect(answer.body.data.modifiedAt).not.toBeNull()
    expect(answer.headers.get('etag')).toBe(answer.body.data.etag)
    expect(answer.body.data.etag).not.toBe(before.body.data.etag)
  })

  it('refuses an outdated version with 412', async () => {
    seed()
    const answer = await call('PATCH', '/mailbox-templates/2', {
      ifMatch: '"stale"',
      body: { quota: 0 },
    })
    expect(answer.status).toBe(412)
  })

  it('refuses renaming Default and taking a name in use, but keeps the own name in another case', async () => {
    seed()
    const renamed = await call('PATCH', '/mailbox-templates/1', { body: { name: 'Main' } })
    expect(renamed.status).toBe(409)
    expect(renamed.body.type).toBe('/api/v2/problems/mailbox-template-protected')
    const values = await call('PATCH', '/mailbox-templates/1', { body: { quota: GIB } })
    expect(values.status).toBe(200)
    const taken = await call('PATCH', '/mailbox-templates/3', { body: { name: 'small' } })
    expect(taken.body.type).toBe('/api/v2/problems/mailbox-template-name-exists')
    const own = await call('PATCH', '/mailbox-templates/3', { body: { name: 'STAFF' } })
    expect(own.body.data.name).toBe('STAFF')
  })

  it('answers 404 for an unknown template and 403 to a domain administrator', async () => {
    seed()
    expect((await call('PATCH', '/mailbox-templates/99', { body: { quota: 0 } })).status).toBe(404)
    seed('reseller')
    expect((await call('PATCH', '/mailbox-templates/2', { body: { quota: 0 } })).status).toBe(403)
  })

  it('answers an injected failure', async () => {
    const state = seed()
    state.mailboxFailures['template:2'] = { status: 500, operations: ['updateMailboxTemplate'] }
    expect((await call('PATCH', '/mailbox-templates/2', { body: { quota: 0 } })).status).toBe(500)
    expect((await call('DELETE', '/mailbox-templates/2')).status).toBe(204)
  })
})

describe('deleteMailboxTemplate', () => {
  it('deletes with the current version and refuses an outdated one and Default', async () => {
    const state = seed()
    const small = await call('GET', '/mailbox-templates/2')
    expect((await call('DELETE', '/mailbox-templates/2', { ifMatch: '"stale"' })).status).toBe(412)
    expect(
      (await call('DELETE', '/mailbox-templates/2', { ifMatch: small.headers.get('etag')! }))
        .status,
    ).toBe(204)
    expect(names(state)).toEqual(['Default', 'Staff'])
    const protectedOne = await call('DELETE', '/mailbox-templates/1')
    expect(protectedOne.status).toBe(409)
    expect(protectedOne.body.type).toBe('/api/v2/problems/mailbox-template-protected')
    expect((await call('DELETE', '/mailbox-templates/2')).status).toBe(404)
  })

  it('answers 403 to a domain administrator', async () => {
    seed('reseller')
    expect((await call('DELETE', '/mailbox-templates/2')).status).toBe(403)
  })
})

describe('applyMailboxTemplateBulkAction', () => {
  it('reports each target once with its outcome and the summary', async () => {
    const state = seed()
    state.mailboxTemplates.push(mockMailboxTemplate({ id: 4, name: 'Broken' }))
    state.mailboxFailures['template:4'] = { status: 500 }
    const staff = await call('GET', '/mailbox-templates/3')
    const answer = await call('POST', '/mailbox-templates/bulk-actions', {
      body: {
        action: 'delete',
        targets: [
          { id: '2', version: '"stale"' },
          { id: '3', version: staff.body.data.etag },
          { id: '3' },
          { id: '1' },
          { id: '4' },
          { id: '99' },
          { id: 'x' },
        ],
      },
    })
    expect(answer.status).toBe(200)
    expect(
      answer.body.data.results.map((item: { id: string; outcome: string }) => [
        item.id,
        item.outcome,
      ]),
    ).toEqual([
      ['2', 'outdated'],
      ['3', 'done'],
      ['1', 'refused'],
      ['4', 'failed'],
      ['99', 'notFound'],
      ['x', 'notFound'],
    ])
    expect(answer.body.data.results[2].problem.type).toBe(
      '/api/v2/problems/mailbox-template-protected',
    )
    expect(answer.body.data.summary).toEqual({
      total: 6,
      done: 1,
      notFound: 2,
      refused: 1,
      outdated: 1,
      failed: 1,
    })
    expect(names(state)).toEqual(['Default', 'Small', 'Broken'])
  })

  it('answers 403 to a domain administrator', async () => {
    seed('reseller')
    const refused = await call('POST', '/mailbox-templates/bulk-actions', {
      body: { action: 'delete', targets: [{ id: '2' }] },
    })
    expect(refused.status).toBe(403)
  })
})

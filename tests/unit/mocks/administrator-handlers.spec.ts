import { expect, it } from 'vitest'
import { api, type Writable, type DomainAdminPatch, type DomainAdmin } from '@/api'
import { useScenario } from '../../mocks/node'

const domainAdmins = async () => (await api.GET('/domain-admins')).data!.data
const domainAdmin = async (username: string) =>
  (await api.GET('/domain-admins/{username}', { params: { path: { username } } })).data!.data
const administrator = async (username: string) =>
  (await api.GET('/admins/{username}', { params: { path: { username } } })).data!.data
const create = (username = ' Created.One ', domains = ['example.org']) =>
  api.POST('/domain-admins', {
    body: {
      username,
      domains,
      password: 'Secret-123!',
      active: true,
      forcePasswordChange: false,
      forceSecondFactorSetup: false,
    },
  })
const patch = (item: DomainAdmin, body: Writable<DomainAdminPatch>) =>
  api.PATCH('/domain-admins/{username}', {
    headers: { 'Content-Type': 'application/merge-patch+json' },
    params: { path: { username: item.username }, header: { 'If-Match': item.etag } },
    body,
  })

it('exposes server defaults only to administrators', async () => {
  useScenario('domain-admins-three')
  expect((await api.GET('/capabilities/accounts')).data!.data).toMatchObject({
    bulkLimit: 100,
    usernameMaxLength: 255,
    domainAdminPermissionDefaults: { unlimitedQuota: false, syncjobs: true },
  })
  useScenario('domain-admins-as-domain-admin')
  await expect(api.GET('/domain-admins')).rejects.toMatchObject({ status: 403 })
  await expect(api.GET('/capabilities/accounts')).rejects.toMatchObject({ status: 403 })
})
it('searches domains and usernames, filters flags/status and pages sorted accounts', async () => {
  useScenario('domain-admins-three')
  const result = await api.GET('/domain-admins', {
    params: { query: { q: 'example.org', sort: 'username', order: 'desc', limit: 1, offset: 1 } },
  })
  expect(result.data!.meta).toMatchObject({ total: 2, limit: 1, offset: 1 })
  expect(result.data!.data.map((item) => item.username)).toEqual(['reseller'])
  const permission = await api.GET('/domain-admins', {
    params: { query: { permission: 'loginAs', permissionValue: false } },
  })
  expect(permission.data!.data.map((item) => item.username)).toEqual(['reseller'])
})
it('creates normalised accounts and assignments atomically, returns ETag and never a password', async () => {
  const state = useScenario('domain-admins-three')
  const result = await create(' Created.One ', ['example.org', 'EXAMPLE.ORG', 'example.net'])
  expect(result.response.status).toBe(201)
  expect(result.response.headers.get('Location')).toBe('/api/v2/domain-admins/created.one')
  expect(result.response.headers.get('ETag')).toBe(result.data!.data.etag)
  expect(result.data!.data.domains.map((item) => item.domain)).toEqual([
    'example.net',
    'example.org',
  ])
  expect(result.data!.data.permissions.unlimitedQuota).toBe(false)
  expect(JSON.stringify(result.data)).not.toContain('Secret-123!')
  expect(
    state.accounts.some((item) => item.username === 'created.one' && item.role === 'domainAdmin'),
  ).toBe(true)
})
it('rejects names across both roles case-insensitively and reserved usernames', async () => {
  useScenario('domain-admins-three')
  await expect(create('ADMIN')).rejects.toMatchObject({
    status: 409,
    type: '/api/v2/problems/account-exists',
  })
  await expect(create('API')).rejects.toMatchObject({
    status: 422,
    fieldErrors: new Map([['username', [expect.objectContaining({ code: 'reserved' })]]]),
  })
})
it('returns indexed domain errors and does not partly create an account', async () => {
  useScenario('domain-admins-three')
  await expect(create('bad-domains', ['example.org', 'removed.example'])).rejects.toMatchObject({
    status: 422,
    fieldErrors: new Map([['domains.1', [expect.objectContaining({ code: 'notFound' })]]]),
  })
  await expect(domainAdmin('bad-domains')).rejects.toMatchObject({ status: 404 })
})
it('renames with If-Match, changes the version and leaves the old path absent', async () => {
  const state = useScenario('domain-admins-three')
  const item = await domainAdmin('RESELLER')
  const saved = (await patch(item, { username: ' Renamed ' })).data!.data
  expect(saved.username).toBe('renamed')
  expect(saved.etag).not.toBe(item.etag)
  expect(state.accounts.some((item) => item.username === 'renamed')).toBe(true)
  await expect(domainAdmin('reseller')).rejects.toMatchObject({ status: 404 })
  await expect(patch({ ...saved, etag: item.etag }, { active: false })).rejects.toMatchObject({
    status: 412,
  })
})
it('replaces domains while preserving retained assignment metadata and merges a missing permission record as false', async () => {
  const state = useScenario('domain-admins-edge')
  const item = await domainAdmin('without-acl')
  const saved = (
    await patch(item, { permissions: { loginAs: true }, domains: ['example.org', 'example.net'] })
  ).data!.data
  expect(saved.permissions.loginAs).toBe(true)
  expect(saved.permissions.syncjobs).toBe(false)
  expect(saved.domains.find((entry) => entry.domain === 'example.org')!.createdAt).toBe(
    item.domains[0]!.createdAt,
  )
  expect(
    state.domainAdmins.find((entry) => entry.username === item.username)!.permissions,
  ).not.toBeNull()
})
it('applies inactive status to assignments and suspends second factors without changing passkeys or the settings version', async () => {
  useScenario('domain-admins-three')
  const item = await domainAdmin('team')
  const suspended = (
    await api.POST('/domain-admins/{username}/second-factor-suspension', {
      params: { path: { username: item.username }, header: { 'If-Match': item.etag } },
    })
  ).data!.data
  expect(suspended).toMatchObject({
    secondFactorStatus: 'suspended',
    activePasskeyCount: item.activePasskeyCount,
    etag: item.etag,
  })
  const inactive = (await patch(suspended, { active: false })).data!.data
  expect(inactive.domains.every((entry) => !entry.active)).toBe(true)
})
it('keeps one outcome per selected username and carries the new version after partial bulk results', async () => {
  useScenario('domain-admins-three')
  const [one, two] = await domainAdmins()
  const result = (
    await api.POST('/domain-admins/bulk-actions', {
      body: {
        action: 'deactivate',
        targets: [
          { id: one!.username, version: one!.etag },
          { id: one!.username.toUpperCase(), version: one!.etag },
          { id: two!.username, version: '"old"' },
          { id: 'gone', version: '"old"' },
        ],
      },
    })
  ).data!.data
  expect(result.results.map((item) => item.outcome)).toEqual(['done', 'outdated', 'notFound'])
  expect(result.results[0]!.version).toBe((await domainAdmin(one!.username)).etag)
  expect(result.summary).toMatchObject({ total: 3, done: 1, outdated: 1, notFound: 1 })
})
it('protects the own and last active administrator accounts', async () => {
  useScenario('admins-one')
  const item = await administrator('admin')
  await expect(
    api.DELETE('/admins/{username}', {
      params: { path: { username: item.username }, header: { 'If-Match': item.etag } },
    }),
  ).rejects.toMatchObject({ status: 409, type: '/api/v2/problems/cannot-delete-own-account' })
  await expect(
    api.PATCH('/admins/{username}', {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      params: { path: { username: item.username }, header: { 'If-Match': item.etag } },
      body: { active: false },
    }),
  ).rejects.toMatchObject({ status: 409, type: '/api/v2/problems/last-active-admin' })
})
it('deletes an administrator while preserving domains and mailboxes', async () => {
  const state = useScenario('admins-three')
  const item = await administrator('operator')
  const domains = state.domains.map((item) => item.name)
  const mailboxes = state.mailboxes.length
  expect(
    (
      await api.DELETE('/admins/{username}', {
        params: { path: { username: item.username }, header: { 'If-Match': item.etag } },
      })
    ).response.status,
  ).toBe(204)
  await expect(administrator('operator')).rejects.toMatchObject({ status: 404 })
  expect(state.domains.map((item) => item.name)).toEqual(domains)
  expect(state.mailboxes).toHaveLength(mailboxes)
})

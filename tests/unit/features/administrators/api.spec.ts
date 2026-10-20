import { expect, it } from 'vitest'
import { effectScope } from 'vue'
import { createQueryClient, queryKeys } from '@/api'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import {
  createAccount,
  fetchAccount,
  updateAccount,
  changeAccountPassword,
  rememberAccount,
  accountListOptions,
  accountCapabilitiesOptions,
  activeAdminCountOptions,
} from '@/features/administrators/api'
import { mockState, useScenario } from '../../../mocks/node'

it('keeps create and password updates outside both query caches, caching metadata only', async () => {
  useScenario('domain-admins-three')
  const client = createQueryClient({ retryDelay: 0 })
  const scope = effectScope()
  const create = scope.run(() => useSecretRequest(createAccount))!
  const secret = 'Never-cache-this-password-123!'
  const item = await create.run('domainAdmin', {
    username: 'new-owner',
    password: secret,
    domains: ['example.org'],
    active: true,
    forcePasswordChange: false,
    forceSecondFactorSetup: false,
  })
  expect(item?.username).toBe('new-owner')
  rememberAccount(client, 'domainAdmin', item!)
  const password = scope.run(() => useSecretRequest(changeAccountPassword))!
  const updated = await password.run(
    'domainAdmin',
    item!.username,
    'Replacement-secret-456!',
    item!.etag,
  )
  expect(updated?.username).toBe(item!.username)
  expect(client.getMutationCache().getAll()).toEqual([])
  const cached = JSON.stringify(
    client
      .getQueryCache()
      .getAll()
      .map((query) => query.state),
  )
  expect(cached).not.toContain(secret)
  expect(cached).not.toContain('Replacement-secret-456!')
  scope.stop()
  expect(create.result.value).toBeNull()
  expect(password.result.value).toBeNull()
})
it('sends JSON Merge Patch with If-Match, removes the old rename key and invalidates the lists', async () => {
  useScenario('domain-admins-three')
  const client = createQueryClient({ retryDelay: 0 })
  const page = await client.fetchQuery(accountListOptions('domainAdmin', { limit: 25, offset: 0 }))
  const item = page.data.find((item) => item.username === 'reseller')!
  client.setQueryData(queryKeys.domainAdmins.detail(item.username), item)
  const updated = await updateAccount(
    client,
    'domainAdmin',
    item.username,
    { username: 'renamed' },
    item.etag,
  )
  expect(client.getQueryData(queryKeys.domainAdmins.detail('reseller'))).toBeUndefined()
  expect(client.getQueryData(queryKeys.domainAdmins.detail('renamed'))).toEqual(updated)
  expect(
    client.getQueryState(queryKeys.domainAdmins.list({ limit: 25, offset: 0 }))?.isInvalidated,
  ).toBe(true)
  expect(
    mockState().requests.findLast((request) => request.operationId === 'updateDomainAdmin'),
  ).toMatchObject({
    body: { username: 'renamed' },
    headers: { 'if-match': item.etag, 'content-type': 'application/merge-patch+json' },
  })
})
it('separates account roles and reads capabilities and the global active-admin count', async () => {
  useScenario('admins-three')
  const client = createQueryClient({ retryDelay: 0 })
  expect(await client.fetchQuery(activeAdminCountOptions())).toBe(2)
  expect((await client.fetchQuery(accountCapabilitiesOptions())).bulkLimit).toBe(100)
  await expect(fetchAccount('domainAdmin', 'admin')).rejects.toMatchObject({ status: 404 })
  expect((await fetchAccount('admin', 'ADMIN')).username).toBe('admin')
})

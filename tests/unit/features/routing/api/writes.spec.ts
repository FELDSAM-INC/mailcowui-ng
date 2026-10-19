// UI 009 T032, T044, T059, T083: the routing data layer. Relayhost and transport writes are direct
// calls that never reach a query or mutation cache, so no password is kept (conventions "Secrets",
// research R7); updates send the version tag and a merge patch; assignment replacements write the
// cache and invalidate what shows the relayhost.
import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/api'
import {
  afterRelayhostWrite,
  createRelayhost,
  fetchRelayhost,
  updateRelayhost,
} from '@/features/routing/api/relayhosts'
import {
  replaceDomainAssignment,
  replaceMailboxAssignment,
  fetchDomainAssignment,
  fetchMailboxAssignment,
} from '@/features/routing/api/relayhost-assignments'
import { createTransport, fetchTransport, updateTransport } from '@/features/routing/api/transports'
import { ApiProblem } from '@/api'

import { mockState, useScenario } from '../../../../mocks/node'
import { testPlugins } from '../../../support/mount'

const PASSWORDS = ['Api-Secret-1', 'Api-Secret-2', 'Api-Secret-3', 'Api-Secret-4']

function cachesHold(secret: string): boolean {
  const { queryClient } = testPlugins()
  const queries = queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.state.data)
  const mutations = queryClient
    .getMutationCache()
    .getAll()
    .map((mutation) => [mutation.state.variables, mutation.state.data])
  return JSON.stringify([queries, mutations]).includes(secret)
}

const last = (operationId: string) =>
  mockState()
    .requests.filter((request) => request.operationId === operationId)
    .at(-1)

describe('relayhost and transport writes', () => {
  it('creates and updates relayhosts without keeping the password in any cache', async () => {
    useScenario('routing-admin-default')
    const { queryClient } = testPlugins()
    const created = await createRelayhost({
      host: '[api.example]:587',
      username: 'api-user',
      password: PASSWORDS[0]!,
    })
    await afterRelayhostWrite(queryClient, created)
    expect(queryClient.getQueryData(queryKeys.relayhosts.detail(created.id))).toEqual(created)
    const updated = await updateRelayhost(created.id, { password: PASSWORDS[1]! }, created.etag)
    expect(last('updateRelayhost')?.headers['if-match']).toBe(created.etag)
    expect(last('updateRelayhost')?.headers['content-type']).toContain('merge-patch+json')
    await expect(
      updateRelayhost(created.id, { password: PASSWORDS[2]! }, '"outdated"'),
    ).rejects.toBeInstanceOf(ApiProblem)
    expect((await fetchRelayhost(created.id)).etag).toBe(updated.etag)
    for (const secret of PASSWORDS.slice(0, 3)) expect(cachesHold(secret)).toBe(false)
    expect(JSON.stringify(created)).not.toContain(PASSWORDS[0])
  })

  it('creates and updates transports without keeping the password in any cache', async () => {
    useScenario('routing-admin-default')
    const created = await createTransport({
      destination: 'api.example',
      nextHop: '[relay.api.example]:25',
      username: 'api-user',
      password: PASSWORDS[3]!,
    })
    const result = await updateTransport(
      created.transport.id,
      { active: false },
      created.transport.etag,
    )
    expect(result.transport.active).toBe(false)
    expect((await fetchTransport(created.transport.id)).active).toBe(false)
    expect(cachesHold(PASSWORDS[3]!)).toBe(false)
  })
})

describe('relayhost assignments', () => {
  it('replaces a domain’s and a mailbox’s relayhost with the version tag and writes the cache', async () => {
    useScenario('routing-assignments')
    const { queryClient } = testPlugins()
    const domain = await fetchDomainAssignment('example.org')
    const replaced = await replaceDomainAssignment(queryClient, 'example.org', 2, domain.etag)
    expect(replaced.relayhost?.id).toBe(2)
    expect(last('replaceDomainRelayhostAssignment')?.body).toEqual({ relayhostId: 2 })
    expect(queryClient.getQueryData(queryKeys.relayhostAssignments.domain('example.org'))).toEqual(
      replaced,
    )
    const mailbox = await fetchMailboxAssignment('alice@example.org')
    const cleared = await replaceMailboxAssignment(
      queryClient,
      'alice@example.org',
      null,
      mailbox.etag,
    )
    expect(cleared.relayhost).toBeNull()
    await expect(
      replaceMailboxAssignment(queryClient, 'alice@example.org', 1, '"outdated"'),
    ).rejects.toMatchObject({ status: 412 })
  })
})

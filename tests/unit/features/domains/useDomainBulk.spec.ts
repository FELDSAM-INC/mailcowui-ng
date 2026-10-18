// Bulk actions on domains (UI 002 T073, research D22, data-model §7 "Bulk action on domains").
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'

import type { Domain } from '@/api'
import { fetchDomains } from '@/features/domains/api'
import { useDomainBulk } from '@/features/domains/composables/useDomainBulk'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import * as confirmModule from '@/shared/composables/useConfirm'

import { mockDomain } from '../../../mocks/factories/domain'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

async function setup() {
  const state = useScenario('admin-active')
  state.domains = [
    mockDomain({ name: 'a.example' }),
    mockDomain({ name: 'b.example' }),
    mockDomain({
      name: 'busy.example',
      usage: {
        mailboxes: 2,
        resources: 0,
        aliases: 0,
        largestMailboxQuota: 0,
        quotaAllocated: 0,
        storageUsed: 0,
        messages: 0,
      },
    }),
  ]
  const entries = shallowRef<Domain[]>((await fetchDomains({ limit: 25, offset: 0 })).data)
  let api!: {
    bulk: ReturnType<typeof useDomainBulk>
    selection: ReturnType<typeof useBulkSelection>
  }
  mountWithApp(
    defineComponent({
      setup() {
        const selection = useBulkSelection({ limit: 100 })
        const bulk = useDomainBulk({ selection, entries: () => entries.value })
        api = { bulk, selection }
        return () => h('div')
      },
    }),
  )
  return { state, entries, ...api }
}

const bulkRequests = () =>
  mockState().requests.filter((r) => r.operationId === 'applyDomainBulkAction' && r.status !== 403)

describe('useDomainBulk', () => {
  it('activates without a confirmation and reports one row per domain', async () => {
    const { bulk, selection } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm')
    selection.selectPage(['a.example', 'b.example'])
    await bulk.run('activate')
    expect(ask).not.toHaveBeenCalled()
    expect(bulk.phase.value).toBe('results')
    expect(bulk.rows.value.map((row) => [row.id, row.outcome])).toEqual([
      ['a.example', 'done'],
      ['b.example', 'done'],
    ])
    expect(selection.count.value).toBe(0)
  })

  it('asks before deactivating and stops when declined', async () => {
    const { bulk, selection } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(false)
    selection.selectPage(['a.example'])
    await bulk.run('deactivate')
    expect(ask).toHaveBeenCalledTimes(1)
    expect(bulk.phase.value).toBe('idle')
    expect(bulkRequests()).toHaveLength(0)
  })

  it('skips domains with mailboxes from a deletion and needs the count typed', async () => {
    const { bulk, selection } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    selection.selectPage(['a.example', 'busy.example'])
    await bulk.run('delete')
    expect(ask.mock.calls[0]![0].requireTyped?.accepted).toEqual(['1'])
    expect(bulk.rows.value.map((row) => [row.id, row.outcome])).toEqual([
      ['a.example', 'done'],
      ['busy.example', 'skipped'],
    ])
    expect(
      (bulkRequests()[0]!.body as { targets: { id: string }[] }).targets.map((t) => t.id),
    ).toEqual(['a.example'])
  })

  it('keeps failed, refused and outdated domains selected and retries exactly those', async () => {
    const { state, bulk, selection } = await setup()
    state.domainFailures['b.example'] = { status: 503, type: 'temporary-failure', times: 1 }
    selection.selectPage(['a.example', 'b.example'])
    await bulk.run('activate')
    expect([...selection.ids.value]).toEqual(['b.example'])
    await bulk.retry()
    const [, retry] = bulkRequests()
    expect((retry!.body as { targets: { id: string }[] }).targets.map((t) => t.id)).toEqual([
      'b.example',
    ])
    expect(bulk.rows.value.map((row) => row.outcome)).toEqual(['done'])
  })

  it('retries a confirmed action without asking again', async () => {
    const { state, bulk, selection } = await setup()
    state.domainFailures['b.example'] = { status: 503, type: 'temporary-failure', times: 1 }
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    selection.selectPage(['a.example', 'b.example'])
    await bulk.run('deactivate')
    expect(ask).toHaveBeenCalledTimes(1)
    await bulk.retry()
    expect(ask).toHaveBeenCalledTimes(1)
    expect(bulkRequests()).toHaveLength(2)
    expect(bulk.rows.value.map((row) => [row.id, row.outcome])).toEqual([['b.example', 'done']])
  })

  it('reports every target as outcome unknown when the connection is lost, and clears the selection', async () => {
    const { bulk, selection } = await setup()
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    selection.selectPage(['a.example', 'b.example'])
    await bulk.run('activate')
    expect(fetch).toHaveBeenCalled()
    expect(bulk.rows.value.map((row) => row.outcome)).toEqual(['unknown', 'unknown'])
    expect(selection.count.value).toBe(0)
    expect(bulk.canRetry.value).toBe(false)
  })
})

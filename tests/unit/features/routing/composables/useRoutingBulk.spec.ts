// Bulk actions of a routing list (UI 009 T010, research R5): one request with each entry's
// version, a typed count before a deletion, a row per entry with legacy's message, refused,
// outdated and failed entries kept selected, one message for a whole-request refusal, and
// "outcome unknown" without a retry when the connection drops.
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { Relayhost } from '@/api'
import { lt } from '@/i18n'
import { applyRelayhostBulkAction, fetchRelayhosts } from '@/features/routing/api/relayhosts'
import { useRoutingBulk } from '@/features/routing/composables/useRoutingBulk'
import { targetOf } from '@/features/routing/logic/bulk-actions'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import * as confirmModule from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../../mocks/node'
import { testPlugins } from '../../../support/mount'
import { withSetup } from '../../../support/composable'

async function setup(limit = 100) {
  const state = useScenario('routing-admin-default')
  const entries = shallowRef<Relayhost[]>(
    (await fetchRelayhosts({ limit: 25, offset: 0, sort: 'id', order: 'asc' })).data,
  )
  const refetch = vi.fn(async () => {
    entries.value = (await fetchRelayhosts({ limit: 25, offset: 0, sort: 'id', order: 'asc' })).data
  })
  const { result } = withSetup(() => {
    const selection = useBulkSelection({ limit })
    const bulk = useRoutingBulk<Relayhost>({
      collection: 'relayhosts',
      selection,
      entries: () => entries.value,
      idOf: (item) => String(item.id),
      nameOf: (item) => item.host,
      targetOf,
      send: (action, targets) =>
        applyRelayhostBulkAction(testPlugins().queryClient, {
          action: action as 'activate' | 'deactivate' | 'delete',
          targets,
        }),
      refetch,
      message: (row, entry, action) =>
        row.outcome === 'done' && action === 'deactivate'
          ? lt('success.object_modified', entry?.host ?? '')
          : null,
    })
    return { selection, bulk }
  })
  return { state, entries, refetch, ...result }
}

const requests = () =>
  mockState().requests.filter((item) => item.operationId === 'applyRelayhostBulkAction')

describe('useRoutingBulk', () => {
  it('sends each selected entry with its version and keeps the outdated one selected', async () => {
    const { bulk, selection, state } = await setup()
    selection.enter()
    selection.toggle('2')
    selection.toggle('4')
    state.routing.relayhosts.find((item) => item.id === 4)!.username = 'changed'
    await bulk.run('deactivate')
    expect(requests()[0]!.body).toMatchObject({
      action: 'deactivate',
      targets: [
        { id: '2', version: expect.any(String) },
        { id: '4', version: expect.any(String) },
      ],
    })
    expect(bulk.rows.value.map((row) => row.outcome)).toEqual(['done', 'outdated'])
    expect(bulk.message(bulk.rows.value[0]!)).toBe(
      lt('success.object_modified', 'relay.example.com'),
    )
    expect([...selection.ids.value]).toEqual(['4'])
    expect(bulk.canRetry.value).toBe(true)
    expect(bulk.label('delete')).toBe(lt('admin.remove'))
  })

  it('asks for the typed count before a deletion, and retries after a refetch without asking', async () => {
    const { bulk, selection, refetch, state } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(false)
    selection.toggle('3')
    await bulk.run('delete')
    expect(ask.mock.calls[0]![0].requireTyped?.accepted).toEqual(['1'])
    expect(requests()).toHaveLength(0)
    ask.mockResolvedValue(true)
    state.routing.relayhosts.find((item) => item.id === 3)!.host = 'changed.example'
    await bulk.run('delete')
    expect(bulk.rows.value[0]!.outcome).toBe('outdated')
    await bulk.retry()
    expect(refetch).toHaveBeenCalled()
    expect(ask).toHaveBeenCalledTimes(2)
    expect(bulk.rows.value[0]!.outcome).toBe('done')
    bulk.close()
    expect(bulk.phase.value).toBe('idle')
  })

  it('reports a whole-request refusal once and a lost connection as unknown', async () => {
    const { bulk, selection, state } = await setup()
    selection.toggle('1')
    state.failures.applyRelayhostBulkAction = { status: 403, type: 'forbidden', times: 1 }
    await bulk.run('activate')
    expect(bulk.problem.value?.status).toBe(403)
    expect(bulk.rows.value).toEqual([])
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'))
    await bulk.run('activate')
    expect(bulk.rows.value.map((row) => row.outcome)).toEqual(['unknown'])
    expect(selection.count.value).toBe(0)
    fetchSpy.mockRestore()
  })
})

import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { fetchQuarantineItems } from '@/features/quarantine/api'
import * as confirmations from '@/features/quarantine/bulk-confirmations'
import { useQuarantineBulk } from '@/features/quarantine/composables/useQuarantineBulk'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'

import { mockState, server, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const mounted: { unmount(): void }[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
const writes = () =>
  mockState().requests.filter((request) => request.operationId === 'applyQuarantineBulkAction')

async function setup(scenario = 'quarantine-mailbox-user') {
  useScenario(scenario)
  let entries = (await fetchQuarantineItems({ limit: 50, sort: 'id', order: 'desc' })).data
  const selection = useBulkSelection()
  const ask = vi.spyOn(confirmations, 'askQuarantineBulk').mockResolvedValue(true)
  const refresh = vi.fn(async () => {
    entries = (await fetchQuarantineItems({ limit: 50, sort: 'id', order: 'desc' })).data
  })
  let bulk!: ReturnType<typeof useQuarantineBulk>
  mounted.push(
    mountWithApp(
      defineComponent({
        setup() {
          bulk = useQuarantineBulk({ selection, entries: () => entries, refresh })
          return () => h('div')
        },
      }),
    ),
  )
  return { bulk, selection, ask, refresh, entries }
}

describe('useQuarantineBulk', () => {
  it('confirms the visible targets, sends each listed version once and removes done selections', async () => {
    const { bulk, selection, ask, entries } = await setup()
    selection.selectPage(['30', '29'])
    await bulk.run('release')
    expect(ask).toHaveBeenCalledWith('release', entries.slice(0, 2))
    expect(writes()).toHaveLength(1)
    expect(writes()[0]!.body).toEqual({
      action: 'release',
      targets: entries.slice(0, 2).map((item) => ({ id: String(item.id), version: item.etag })),
    })
    expect(bulk.rows.value.map((row) => row.outcome)).toEqual(['done', 'done'])
    expect(selection.count.value).toBe(0)
    expect(bulk.linesFor('30').map((line) => line.text)).toContain('Item 30 released')
  })

  it('retains only refused, failed and outdated targets, and keeps learning warnings on done rows', async () => {
    const { bulk, selection } = await setup('quarantine-bulk-failures')
    selection.selectPage(['150', '149', '148', '147', '146', '145', '144'])
    await bulk.run('release')
    expect(bulk.rows.value.map((row) => row.outcome)).toEqual([
      'notFound',
      'refused',
      'refused',
      'failed',
      'outdated',
      'done',
      'done',
    ])
    expect([...selection.ids.value]).toEqual(['149', '148', '147', '146'])
    expect(bulk.linesFor('145').some((line) => line.kind === 'danger')).toBe(true)
    expect(bulk.itemFor('150')?.id).toBe(150)
  })

  it('refreshes and confirms again before retrying with a new version', async () => {
    const { bulk, selection, ask, refresh } = await setup('quarantine-bulk-failures')
    const stored = mockState().quarantine.items.find((item) => item.id === 146)!
    stored.inject = {}
    stored.queueId = 'UPDATEDQUEUE146'
    selection.toggle('146')
    await bulk.run('delete')
    expect(bulk.rows.value[0]?.outcome).toBe('outdated')
    await bulk.retry()
    expect(refresh).toHaveBeenCalledOnce()
    expect(ask).toHaveBeenCalledTimes(2)
    expect(writes()).toHaveLength(2)
    expect(writes()[1]!.body).not.toEqual(writes()[0]!.body)
    expect(bulk.rows.value[0]?.outcome).toBe('done')
  })

  it('reports a lost response as unknown, invalidates the list and never resends on retry', async () => {
    const { bulk, selection } = await setup()
    let requests = 0
    server.use(
      http.post('*/quarantine/bulk-actions', () => {
        requests++
        return HttpResponse.error()
      }),
    )
    selection.selectPage(['30', '29'])
    await bulk.run('delete')
    await flushPromises()
    expect(bulk.rows.value.map((row) => row.outcome)).toEqual(['unknown', 'unknown'])
    expect(selection.count.value).toBe(0)
    await bulk.retry()
    expect(requests).toBe(1)
  })

  it('keeps the selection on a whole-request 403', async () => {
    const { bulk, selection } = await setup('quarantine-user-no-actions')
    selection.selectPage(['30', '29'])
    await bulk.run('delete')
    expect(bulk.problem.value?.status).toBe(403)
    expect(bulk.rows.value).toEqual([])
    expect([...selection.ids.value]).toEqual(['30', '29'])
  })

  it('never treats a newly selected message as a retry of an earlier failure', async () => {
    const { bulk, selection } = await setup('quarantine-bulk-failures')
    selection.toggle('149')
    await bulk.run('release')
    selection.clear()
    selection.toggle('144')
    await bulk.retry()
    expect(writes()).toHaveLength(1)
    expect([...selection.ids.value]).toEqual(['144'])
  })

  it('does not submit twice while confirmation is pending or submit after selection is cleared', async () => {
    const { bulk, selection, ask } = await setup()
    let answer!: (value: boolean) => void
    ask.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    )
    selection.toggle('30')
    const pending = bulk.run('delete')
    await bulk.run('delete')
    expect(ask).toHaveBeenCalledOnce()
    selection.clear()
    answer(true)
    await pending
    expect(writes()).toHaveLength(0)
    expect(bulk.busy.value).toBe(false)
  })
})

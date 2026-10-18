// Deleting several templates with the API's bulk operation (UI 002 T087a, FR-055, gap G40).
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'

import type { DomainTemplate } from '@/api'
import { useTemplateBulkDelete } from '@/features/domains/composables/useTemplateBulkDelete'
import { fetchTemplates } from '@/features/domains/templates-api'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import * as confirmModule from '@/shared/composables/useConfirm'

import { mockTemplate } from '../../../mocks/factories/domain-template'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

async function setup() {
  const state = useScenario('admin-active')
  state.domainTemplates = [
    mockTemplate({ id: 1, name: 'Default' }),
    mockTemplate({ id: 2, name: 'Alpha' }),
    mockTemplate({ id: 3, name: 'Beta' }),
    mockTemplate({ id: 4, name: 'Gamma' }),
  ]
  const entries = shallowRef<DomainTemplate[]>(
    (await fetchTemplates({ limit: 25, offset: 0, sort: 'name', order: 'asc' })).data,
  )
  let api!: {
    remove: ReturnType<typeof useTemplateBulkDelete>
    selection: ReturnType<typeof useBulkSelection>
  }
  mountWithApp(
    defineComponent({
      setup() {
        const selection = useBulkSelection({ limit: 100 })
        const remove = useTemplateBulkDelete({ selection, entries: () => entries.value })
        api = { remove, selection }
        return () => h('div')
      },
    }),
  )
  return { state, entries, ...api }
}

const bulkRequests = () =>
  mockState().requests.filter(
    (r) => r.operationId === 'applyDomainTemplateBulkAction' && r.status !== 403,
  )

describe('useTemplateBulkDelete', () => {
  it('asks with the names and the count typed, then sends one request with each version', async () => {
    const { remove, selection, entries } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    selection.selectPage(['2', '3', '1'])
    await remove.run()
    const options = ask.mock.calls[0]![0]
    expect(options.title).toBe('Confirm deletion')
    expect(options.requireTyped?.accepted).toEqual(['2'])
    expect(options.content?.props).toMatchObject({ names: ['Alpha', 'Beta'] })
    const [request] = bulkRequests()
    expect(request!.body).toEqual({
      action: 'delete',
      targets: [
        { id: '2', version: entries.value.find((t) => t.id === 2)!.etag },
        { id: '3', version: entries.value.find((t) => t.id === 3)!.etag },
      ],
    })
    expect(remove.rows.value.map((row) => [row.label, row.outcome])).toEqual([
      ['Alpha', 'done'],
      ['Beta', 'done'],
    ])
    expect(selection.count.value).toBe(0)
  })

  it('keeps outdated and missing templates as rows, retries the outdated without asking again', async () => {
    const { state, remove, selection } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    state.domainTemplates.find((t) => t.id === 3)!.maxAliases = 7
    state.domainTemplates = state.domainTemplates.filter((t) => t.id !== 4)
    selection.selectPage(['2', '3', '4'])
    await remove.run()
    expect(remove.rows.value.map((row) => [row.id, row.outcome])).toEqual([
      ['2', 'done'],
      ['3', 'outdated'],
      ['4', 'notFound'],
    ])
    expect([...selection.ids.value]).toEqual(['3'])
    expect(remove.canRetry.value).toBe(true)
    await remove.retry()
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('reports every template as outcome unknown when the connection is lost', async () => {
    const { remove, selection } = await setup()
    vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    selection.selectPage(['2', '3'])
    await remove.run()
    expect(remove.rows.value.map((row) => row.outcome)).toEqual(['unknown', 'unknown'])
    expect(selection.count.value).toBe(0)
    expect(remove.canRetry.value).toBe(false)
  })
})

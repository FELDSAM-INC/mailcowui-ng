import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useNotificationBulk } from '@/features/quarantine/composables/useNotificationBulk'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import * as confirmation from '@/shared/composables/useConfirm'
import { mockState, server, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const mounted: { unmount(): void }[] = []
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  vi.restoreAllMocks()
})
const writes = () =>
  mockState().requests.filter((r) => r.operationId === 'applyQuarantineNotificationBulkAction')
function setup() {
  useScenario('quarantine-admin')
  const selection = useBulkSelection()
  const ask = vi.spyOn(confirmation, 'confirm').mockResolvedValue(true)
  const refresh = vi.fn(async () => {})
  let bulk!: ReturnType<typeof useNotificationBulk>
  mounted.push(
    mountWithApp(
      defineComponent({
        setup() {
          bulk = useNotificationBulk({
            selection,
            entries: () => ['alice@example.org', 'bob@example.org'].map((address) => ({ address })),
            refresh,
          })
          return () => h('div')
        },
      }),
    ),
  )
  selection.toggle('alice@example.org')
  return { selection, ask, refresh, bulk }
}
describe('notification bulk', () => {
  it('confirms once and sends only explicit targets without versions', async () => {
    const { bulk, ask, selection } = setup()
    await bulk.run({ frequency: 'weekly' })
    expect(ask).toHaveBeenCalledOnce()
    expect(writes()[0]!.body).toEqual({
      frequency: 'weekly',
      targets: [{ id: 'alice@example.org' }],
    })
    expect(bulk.rows.value[0]?.outcome).toBe('done')
    expect(selection.count.value).toBe(0)
  })
  it('cannot open a second confirmation or duplicate the request while confirming', async () => {
    const { bulk, ask } = setup()
    let answer!: (result: boolean) => void
    ask.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    )
    const first = bulk.run({ frequency: 'weekly' })
    const second = bulk.run({ category: 'all' })
    expect(ask).toHaveBeenCalledOnce()
    answer(true)
    await Promise.all([first, second])
    expect(writes()).toHaveLength(1)
  })
  it('does not change newly selected mailboxes through Retry after an unknown result', async () => {
    const { bulk, selection, refresh } = setup()
    let sends = 0
    server.use(
      http.post('*/quarantine-notification-settings/bulk-actions', () => {
        sends++
        return HttpResponse.error()
      }),
    )
    await bulk.run({ frequency: 'weekly' })
    expect(bulk.rows.value[0]?.outcome).toBe('unknown')
    expect(selection.count.value).toBe(0)
    expect(refresh).toHaveBeenCalledOnce()
    selection.toggle('bob@example.org')
    await bulk.retry()
    expect(sends).toBe(1)
    expect([...selection.ids.value]).toEqual(['bob@example.org'])
  })
  it('does not send a confirmed selection that was cleared while the dialog was open', async () => {
    const { bulk, ask, selection } = setup()
    ask.mockImplementation(() => {
      selection.clear()
      return Promise.resolve(true)
    })
    await bulk.run({ category: 'all' })
    expect(writes()).toHaveLength(0)
  })
})

// Deleting mailbox templates (UI 003 T104, FR-062, G39): one template with legacy's confirmation,
// asked again after a 412, explained when it is gone or refused; several with the bulk operation,
// the count typed, a row each, a retry without asking again, and "outcome unknown" when the
// connection is lost.
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { fetchTemplates } from '@/features/mailboxes/templates-api'
import { useTemplateBulkDelete } from '@/features/mailboxes/templates/useTemplateBulkDelete'
import { useTemplateDeletion } from '@/features/mailboxes/templates/useTemplateDeletion'
import type { MailboxTemplate } from '@/features/mailboxes/types'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import * as confirmModule from '@/shared/composables/useConfirm'

import { mockMailboxTemplate } from '../../../../mocks/factories/mailbox-template'
import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'

async function seed() {
  const state = useScenario('admin-active')
  state.mailboxTemplates.push(
    mockMailboxTemplate({ id: 2, name: 'Alpha' }),
    mockMailboxTemplate({ id: 3, name: 'Beta' }),
    mockMailboxTemplate({ id: 4, name: 'Gamma' }),
  )
  const entries = shallowRef<MailboxTemplate[]>(
    (await fetchTemplates({ limit: 25, offset: 0, sort: 'name', order: 'asc' })).data,
  )
  return { state, entries }
}

const router = () =>
  createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/mailbox-templates', name: 'mailbox-templates', component: { render: () => null } },
      { path: '/elsewhere', name: 'elsewhere', component: { render: () => null } },
    ],
  })

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

describe('useTemplateBulkDelete', () => {
  async function setup() {
    const seeded = await seed()
    let api!: {
      remove: ReturnType<typeof useTemplateBulkDelete>
      selection: ReturnType<typeof useBulkSelection>
    }
    mountWithApp(
      defineComponent({
        setup() {
          const selection = useBulkSelection({ limit: 100 })
          const remove = useTemplateBulkDelete({ selection, entries: () => seeded.entries.value })
          api = { remove, selection }
          return () => h('div')
        },
      }),
    )
    return { ...seeded, ...api }
  }

  it('asks with the names and the count typed, then sends one request with each version', async () => {
    const { remove, selection, entries } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    selection.selectPage(['2', '3', '1'])
    await remove.run()
    const options = ask.mock.calls[0]![0]
    expect(options.title).toBe('Confirm deletion')
    expect(options.requireTyped?.accepted).toEqual(['2'])
    expect(options.content?.props).toMatchObject({ names: ['Alpha', 'Beta'] })
    expect(requests('applyMailboxTemplateBulkAction')[0]!.body).toEqual({
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
    remove.close()
    expect(remove.phase.value).toBe('idle')
  })

  it('sends nothing when the confirmation is cancelled', async () => {
    const { remove, selection } = await setup()
    vi.spyOn(confirmModule, 'confirm').mockResolvedValue(false)
    selection.selectPage(['2'])
    await remove.run()
    expect(requests('applyMailboxTemplateBulkAction')).toHaveLength(0)
    expect(remove.phase.value).toBe('idle')
  })

  it('keeps outdated and missing templates as rows, retries the outdated without asking again', async () => {
    const { state, remove, selection } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    state.mailboxTemplates.find((t) => t.id === 3)!.quota = 7
    state.mailboxTemplates = state.mailboxTemplates.filter((t) => t.id !== 4)
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
    expect(requests('applyMailboxTemplateBulkAction')).toHaveLength(2)
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

  it('shows a refusal of the whole request as a problem', async () => {
    const { state, remove, selection } = await setup()
    vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    state.failures.applyMailboxTemplateBulkAction = { status: 500 }
    selection.selectPage(['2'])
    await remove.run()
    expect(remove.rows.value).toEqual([])
    expect(remove.problem.value?.status).toBe(500)
  })
})

describe('useTemplateDeletion', () => {
  async function setup() {
    const seeded = await seed()
    const testRouter = router()
    await testRouter.push('/elsewhere')
    let deletion!: ReturnType<typeof useTemplateDeletion>
    mountWithApp(
      defineComponent({
        setup() {
          deletion = useTemplateDeletion()
          return () => h('div')
        },
      }),
      { global: { plugins: [testRouter] } },
    )
    const template = (id: number) => seeded.entries.value.find((item) => item.id === id)!
    return { ...seeded, deletion, template, testRouter }
  }

  it('deletes after the confirmation and opens the list; never Default', async () => {
    const { deletion, template, testRouter } = await setup()
    vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    expect(await deletion.start(template(1))).toBe('cancelled')
    expect(await deletion.start(template(2))).toBe('deleted')
    expect(testRouter.currentRoute.value.name).toBe('mailbox-templates')
  })

  it('asks again with the reloaded template after a 412', async () => {
    const { state, deletion, template } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    state.mailboxTemplates.find((t) => t.id === 2)!.quota = 7
    expect(await deletion.start(template(2))).toBe('deleted')
    expect(ask).toHaveBeenCalledTimes(2)
    expect(ask.mock.calls[1]![0].description).toBe(
      'The template changed in the meantime. Check it and confirm again.',
    )
    expect(requests('deleteMailboxTemplate').map((request) => request.status)).toEqual([412, 204])
  })

  it('explains a template that is gone and another refusal', async () => {
    const { state, deletion, template } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    state.mailboxTemplates = state.mailboxTemplates.filter((t) => t.id !== 2)
    expect(await deletion.start(template(2))).toBe('gone')
    expect(ask.mock.calls[1]![0].description).toBe('This template no longer exists.')
    state.mailboxFailures['template:3'] = { status: 500 }
    expect(await deletion.start(template(3))).toBe('failed')
    expect(ask.mock.calls.at(-1)![0].description).toContain('Nothing was deleted.')
  })
})

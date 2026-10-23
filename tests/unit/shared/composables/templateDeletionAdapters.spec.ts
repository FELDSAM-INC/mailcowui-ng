// Characterize both feature boundaries before sharing their deletion workflows. Requests still
// pass through the generated client and contract-validated mocks, including active list refresh.
import { useQuery, type QueryKey } from '@tanstack/vue-query'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { queryKeys, type DomainTemplate } from '@/api'
import { useTemplateBulkDelete as useDomainBulkDelete } from '@/features/domains/composables/useTemplateBulkDelete'
import { useTemplateDeletion as useDomainDeletion } from '@/features/domains/composables/useTemplateDeletion'
import * as domainApi from '@/features/domains/templates-api'
import { useTemplateBulkDelete as useMailboxBulkDelete } from '@/features/mailboxes/templates/useTemplateBulkDelete'
import { useTemplateDeletion as useMailboxDeletion } from '@/features/mailboxes/templates/useTemplateDeletion'
import * as mailboxApi from '@/features/mailboxes/templates-api'
import type { MailboxTemplate } from '@/features/mailboxes/types'
import { lt } from '@/i18n'
import * as announcer from '@/shared/composables/useAnnouncer'
import { useBulkSelection, type BulkSelection } from '@/shared/composables/useBulkSelection'
import * as confirmations from '@/shared/composables/useConfirm'

import { mockTemplate } from '../../../mocks/factories/domain-template'
import { mockMailboxTemplate } from '../../../mocks/factories/mailbox-template'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

const params = { limit: 25, offset: 0, sort: 'name', order: 'asc' } as const
const requests = (operation: string) =>
  mockState().requests.filter((request) => request.operationId === operation)

type Template = DomainTemplate | MailboxTemplate
function adapterTests<T extends Template>(adapter: {
  name: string
  seed: () => void
  rename: (id: number) => void
  remove: (id: number) => void
  fetch: () => Promise<T[]>
  useEntries: () => () => readonly T[]
  useDeletion: () => { start: (template: T) => Promise<string>; pending: Ref<boolean> }
  useBulk: (options: {
    selection: BulkSelection
    entries: () => readonly T[]
  }) => ReturnType<typeof useDomainBulkDelete>
  keys: { detail: (id: number) => QueryKey; lists: () => QueryKey }
  route: string
  deleteOperation: string
  getOperation: string
  bulkOperation: string
  keepValuesKey: string
}) {
  describe(`${adapter.name} template deletion adapter`, () => {
    async function setup() {
      useScenario('admin-active')
      adapter.seed()
      const templates = await adapter.fetch()
      const router = createRouter({
        history: createMemoryHistory('/ng/'),
        routes: [
          { path: `/${adapter.route}`, name: adapter.route, component: { render: () => null } },
          { path: '/elsewhere', name: 'elsewhere', component: { render: () => null } },
        ],
      })
      await router.push('/elsewhere')
      let single!: ReturnType<typeof adapter.useDeletion>
      let bulk!: ReturnType<typeof adapter.useBulk>
      let selection!: BulkSelection
      let entries!: () => readonly T[]
      const wrapper = mountWithApp(
        defineComponent({
          setup() {
            entries = adapter.useEntries()
            selection = useBulkSelection({ limit: 100 })
            single = adapter.useDeletion()
            bulk = adapter.useBulk({ selection, entries })
            return () => h('div')
          },
        }),
        { global: { plugins: [router] } },
      )
      await vi.waitFor(() => expect(entries()).toHaveLength(4))
      return {
        single,
        bulk,
        selection,
        entries,
        router,
        wrapper,
        template: (id: number) => templates.find((item) => item.id === id)!,
      }
    }

    it('protects Default, respects cancellation, then announces deletion and opens its list', async () => {
      const { single, template, router, wrapper } = await setup()
      const ask = vi.spyOn(confirmations, 'confirm').mockResolvedValue(false)
      const announce = vi.spyOn(announcer, 'announce')
      expect(await single.start(template(1))).toBe('cancelled')
      expect(ask).not.toHaveBeenCalled()
      expect(await single.start(template(2))).toBe('cancelled')
      expect(requests(adapter.deleteOperation)).toHaveLength(0)
      ask.mockResolvedValue(true)
      expect(await single.start(template(2))).toBe('deleted')
      expect(requests(adapter.deleteOperation)[0]!.headers['if-match']).toBe(template(2).etag)
      expect(announce).toHaveBeenCalledWith(lt('success.template_removed', '2'))
      expect(router.currentRoute.value.name).toBe(adapter.route)
      expect(single.pending.value).toBe(false)
      const content = ask.mock.calls[0]![0].content!
      const dialog = mountWithApp(content.component, { props: content.props })
      expect(dialog.find('li').text()).toBe('Alpha')
      expect(dialog.find('p').text()).toBe(testPlugins().i18n.global.t(adapter.keepValuesKey, 1))
      dialog.unmount()
      wrapper.unmount()
    })

    it('ignores another single deletion while its versioned request is pending', async () => {
      const { single, template, wrapper } = await setup()
      const ask = vi.spyOn(confirmations, 'confirm').mockResolvedValue(true)
      const fetch = globalThis.fetch
      let release!: () => void
      const paused = new Promise<void>((resolve) => {
        release = resolve
      })
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
        if (args[0] instanceof Request && args[0].method === 'DELETE') await paused
        return fetch(...args)
      })
      const deleting = single.start(template(2))
      try {
        await vi.waitFor(() => expect(single.pending.value).toBe(true))
        expect(await single.start(template(3))).toBe('cancelled')
        expect(ask).toHaveBeenCalledTimes(1)
      } finally {
        release()
        await deleting
        wrapper.unmount()
      }
      expect(requests(adapter.deleteOperation)).toHaveLength(1)
      expect(single.pending.value).toBe(false)
    })

    it('reloads a 412 into its detail cache and lets the user cancel the new confirmation', async () => {
      const { single, template, router, wrapper } = await setup()
      adapter.rename(2)
      const ask = vi
        .spyOn(confirmations, 'confirm')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      expect(await single.start(template(2))).toBe('cancelled')
      expect(requests(adapter.deleteOperation).map((request) => request.status)).toEqual([412])
      const refreshed = testPlugins().queryClient.getQueryData<T>(adapter.keys.detail(2))!
      expect(refreshed.name).toBe('Alpha updated')
      expect(refreshed.etag).not.toBe(template(2).etag)
      expect(ask.mock.calls[1]![0].content?.props).toMatchObject({ names: ['Alpha updated'] })
      expect(ask.mock.calls[1]![0].description).toBe(
        'The template changed in the meantime. Check it and confirm again.',
      )
      expect(router.currentRoute.value.name).toBe('elsewhere')
      expect(single.pending.value).toBe(false)
      wrapper.unmount()
    })

    it('uses the freshly reloaded ETag only after reconfirming a 412', async () => {
      const { single, template, wrapper } = await setup()
      adapter.rename(2)
      const fresh = (await adapter.fetch()).find((item) => item.id === 2)!
      const ask = vi.spyOn(confirmations, 'confirm').mockResolvedValue(true)
      expect(await single.start(template(2))).toBe('deleted')
      expect(ask).toHaveBeenCalledTimes(2)
      expect(
        requests(adapter.deleteOperation).map((request) => [
          request.status,
          request.headers['if-match'],
        ]),
      ).toEqual([
        [412, template(2).etag],
        [204, fresh.etag],
      ])
      expect(testPlugins().queryClient.getQueryData(adapter.keys.detail(2))).toBeUndefined()
      wrapper.unmount()
    })

    it('preserves the gone outcome when the 412 reload fails', async () => {
      const { single, template, router, wrapper } = await setup()
      adapter.rename(2)
      mockState().failures[adapter.getOperation] = { status: 500 }
      const ask = vi.spyOn(confirmations, 'confirm').mockResolvedValue(true)
      expect(await single.start(template(2))).toBe('gone')
      expect(ask.mock.calls[1]![0]).toMatchObject({
        alertOnly: true,
        description: 'This template no longer exists.',
      })
      expect(router.currentRoute.value.name).toBe(adapter.route)
      expect(single.pending.value).toBe(false)
      wrapper.unmount()
    })

    it('explains 404 and other refusal outcomes without repeating a deletion', async () => {
      const { single, template, router, wrapper } = await setup()
      adapter.remove(2)
      const ask = vi.spyOn(confirmations, 'confirm').mockResolvedValue(true)
      expect(await single.start(template(2))).toBe('gone')
      expect(router.currentRoute.value.name).toBe(adapter.route)
      await router.push('/elsewhere')
      mockState().failures[adapter.deleteOperation] = { status: 500 }
      expect(await single.start(template(3))).toBe('failed')
      expect(ask.mock.calls.at(-1)![0].description).toContain('Nothing was deleted.')
      expect(router.currentRoute.value.name).toBe('elsewhere')
      expect(single.pending.value).toBe(false)
      wrapper.unmount()
    })

    it('retries only outdated rows with refreshed list versions and no second confirmation', async () => {
      const { bulk, selection, entries, template, wrapper } = await setup()
      const ask = vi.spyOn(confirmations, 'confirm').mockResolvedValue(true)
      adapter.rename(3)
      adapter.remove(4)
      selection.selectPage(['1', '2', '3', '4'])
      await bulk.run()
      expect(ask.mock.calls[0]![0].requireTyped?.accepted).toEqual(['3'])
      expect(bulk.rows.value.map((row) => [row.id, row.outcome])).toEqual([
        ['2', 'done'],
        ['3', 'outdated'],
        ['4', 'notFound'],
      ])
      expect([...selection.ids.value]).toEqual(['3'])
      expect(bulk.canRetry.value).toBe(true)
      await vi.waitFor(() =>
        expect(entries().find((item) => item.id === 3)!.etag).not.toBe(template(3).etag),
      )
      const fresh = entries().find((item) => item.id === 3)!
      const refetch = vi.spyOn(testPlugins().queryClient, 'refetchQueries')
      await bulk.retry()
      expect(refetch).toHaveBeenCalledWith(
        { queryKey: adapter.keys.lists(), type: 'active', stale: true },
        { cancelRefetch: false },
      )
      expect(ask).toHaveBeenCalledTimes(1)
      expect(requests(adapter.bulkOperation).at(-1)!.body).toEqual({
        action: 'delete',
        targets: [{ id: '3', version: fresh.etag }],
      })
      expect(bulk.rows.value.map((row) => row.outcome)).toEqual(['done'])
      expect(selection.count.value).toBe(0)
      expect(bulk.canRetry.value).toBe(false)
      wrapper.unmount()
    })
  })
}

adapterTests({
  name: 'domain',
  seed() {
    mockState().domainTemplates = ['Default', 'Alpha', 'Beta', 'Gamma'].map((name, i) =>
      mockTemplate({ id: i + 1, name }),
    )
  },
  rename(id) {
    mockState().domainTemplates.find((item) => item.id === id)!.name += ' updated'
  },
  remove(id) {
    mockState().domainTemplates = mockState().domainTemplates.filter((item) => item.id !== id)
  },
  fetch: async () => (await domainApi.fetchTemplates(params)).data,
  useEntries() {
    const query = useQuery(domainApi.templateListOptions(params))
    return () => query.data.value?.data ?? []
  },
  useDeletion: useDomainDeletion,
  useBulk: useDomainBulkDelete,
  keys: queryKeys.domainTemplates,
  route: 'domain-templates',
  deleteOperation: 'deleteDomainTemplate',
  getOperation: 'getDomainTemplate',
  bulkOperation: 'applyDomainTemplateBulkAction',
  keepValuesKey: 'domainTemplates.delete.keepValues',
})
adapterTests({
  name: 'mailbox',
  seed() {
    mockState().mailboxTemplates = ['Default', 'Alpha', 'Beta', 'Gamma'].map((name, i) =>
      mockMailboxTemplate({ id: i + 1, name }),
    )
  },
  rename(id) {
    mockState().mailboxTemplates.find((item) => item.id === id)!.name += ' updated'
  },
  remove(id) {
    mockState().mailboxTemplates = mockState().mailboxTemplates.filter((item) => item.id !== id)
  },
  fetch: async () => (await mailboxApi.fetchTemplates(params)).data,
  useEntries() {
    const query = useQuery(mailboxApi.templateListOptions(params))
    return () => query.data.value?.data ?? []
  },
  useDeletion: useMailboxDeletion,
  useBulk: useMailboxBulkDelete,
  keys: queryKeys.mailboxTemplates,
  route: 'mailbox-templates',
  deleteOperation: 'deleteMailboxTemplate',
  getOperation: 'getMailboxTemplate',
  bulkOperation: 'applyMailboxTemplateBulkAction',
  keepValuesKey: 'mailboxTemplates.delete.keepValues',
})

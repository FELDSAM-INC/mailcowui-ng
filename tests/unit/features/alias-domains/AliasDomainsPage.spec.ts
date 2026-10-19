// The domain alias list (US4, US6; FR-033, FR-034, FR-029, FR-030, FR-056 to FR-060): the classic
// table with "Add domain alias" only with `aliasDomains`, the sort, search and filters in the address
// with their chips, the empty, no-match and error states, the single deletion with legacy's alerts
// (deleted, changed in the meantime, vanished, refused), and selection mode with the mass actions and
// one result per alias domain. The end-to-end suite covers the same flows in the browser.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AliasDomainEntryActions from '@/features/alias-domains/components/AliasDomainEntryActions.vue'
import { setAliasDomainListFlash } from '@/features/alias-domains/flash'
import AliasDomainsPage from '@/features/alias-domains/pages/AliasDomainsPage.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { applyOverrides } from '../../../mocks/scenarios'
import { mountPage } from '../aliases-common/page-support'

async function mountList(path = '/alias-domains', wide = true) {
  const { wrapper, router } = await mountPage(AliasDomainsPage, 'alias-domains', path, { wide })
  await vi.waitFor(() =>
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).not.toBe('loading'),
  )
  await flushPromises()
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountList>>['wrapper']

const names = (wrapper: Wrapper) =>
  wrapper.findAll('[data-entry]').map((item) => item.attributes('data-entry'))

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)

const alert = (wrapper: Wrapper) => wrapper.find('[data-alert]')

/** The entry menu's Remove, as the menu emits it. */
async function remove(wrapper: Wrapper, name: string) {
  const actions = wrapper
    .findAllComponents(AliasDomainEntryActions)
    .find((item) => item.props('aliasDomain').name === name)!
  actions.vm.$emit('delete', actions.props('aliasDomain'))
  await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
}

async function select(wrapper: Wrapper, ...entries: string[]) {
  await button(wrapper, 'Select')!.trigger('click')
  for (const name of entries) {
    await wrapper.get(`input[aria-label="Select ${name}"]`).setValue(true)
  }
}

describe('AliasDomainsPage: the list', () => {
  it("shows legacy's table, sorted by name, with Add, Select and Refresh for administrators", async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    expect(wrapper.get('h1').text()).toBe('Domain aliases')
    expect(names(wrapper)).toEqual(['example.eu', 'example.net', 'legacy.example'])
    expect(wrapper.find('a[href="/ng/alias-domains/-/new"]').text()).toContain('Add domain alias')
    expect(wrapper.text()).toContain('Alias domain inactive for relay domain')
    expect(button(wrapper, 'Select')).toBeDefined()
    await button(wrapper, 'Refresh')!.trigger('click')
    await vi.waitFor(() => expect(requests('listAliasDomains').length).toBeGreaterThan(1))
  })

  it('sorts from the table headers through the address', async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountList()
    const header = wrapper.findAll('th button').find((item) => item.text().includes('Target'))!
    await header.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.sort).toBe('targetDomain'))
    await vi.waitFor(() =>
      expect(names(wrapper)).toEqual(['example.eu', 'example.net', 'legacy.example']),
    )
    const active = wrapper.findAll('th').find((item) => item.text().includes('Target'))!
    expect(active.attributes('aria-sort')).toBe('ascending')
  })

  it('hides "Add domain alias" from a domain administrator without aliasDomains', async () => {
    useScenario('alias-domains-da-no-flags')
    const { wrapper } = await mountList()
    expect(names(wrapper)).toEqual(['example.eu', 'example.net'])
    expect(wrapper.find('a[href="/ng/alias-domains/-/new"]').exists()).toBe(false)
    // Mass actions need no flag (US6-AS7).
    expect(button(wrapper, 'Select')).toBeDefined()
  })

  it('shows cards with the narrow sort control, which keeps the sort in the address', async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountList('/alias-domains', false)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(names(wrapper)).toEqual(['example.eu', 'example.net', 'legacy.example'])
    await wrapper.get('#alias-domain-sort').setValue('createdAt')
    await vi.waitFor(() => expect(router.currentRoute.value.query.sort).toBe('createdAt'))
    await wrapper.get('#alias-domain-order').setValue('desc')
    await vi.waitFor(() => expect(router.currentRoute.value.query.order).toBe('desc'))
  })

  it('filters by active through the address, names the filter in a chip, and removes it', async () => {
    useScenario('alias-domains-admin')
    applyOverrides(mockState(), {
      changeElsewhere: { aliasDomain: { 'example.eu': { active: false } } },
    })
    const { wrapper, router } = await mountList()
    await button(wrapper, 'Filters')!.trigger('click')
    await wrapper.get('#alias-domain-filter-active').setValue('false')
    await vi.waitFor(() => expect(router.currentRoute.value.query.active).toBe('false'))
    await vi.waitFor(() => expect(names(wrapper)).toEqual(['example.eu']))
    expect(wrapper.text()).toContain('Active: No')
    const chip = wrapper
      .findAll('button')
      .find((item) => item.attributes('aria-label')?.includes('Active: No'))!
    await chip.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.active).toBeUndefined())
  })

  it('names a target domain filter of the address in a chip', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList('/alias-domains?targetDomain=example.org&active=true')
    await vi.waitFor(() => expect(names(wrapper)).toEqual(['example.net']))
    expect(wrapper.text()).toContain('Target domain: example.org')
    expect(wrapper.text()).toContain('Active: Yes')
    await button(wrapper, 'Clear all filters')!.trigger('click')
    await vi.waitFor(() => expect(names(wrapper)).toHaveLength(3))
  })

  it('searches through the address and offers to clear a search without matches', async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountList('/alias-domains?q=zzz')
    expect(wrapper.get('[data-empty="noMatch"]').text()).toContain('No matching records found')
    const clear = wrapper.get('[data-empty="noMatch"] button')
    await clear.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBeUndefined())
    await vi.waitFor(() => expect(names(wrapper)).toHaveLength(3))
  })

  it('says the table is empty and offers "Add domain alias"', async () => {
    useScenario('alias-domains-admin')
    mockState().aliasDomains = []
    const { wrapper } = await mountList()
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toBe('empty')
    const empty = wrapper.get('[data-empty="none"]')
    expect(empty.text()).toContain('No data available in table')
    expect(empty.find('a[href="/ng/alias-domains/-/new"]').exists()).toBe(true)
  })

  it('says the list could not be loaded and retries', async () => {
    useScenario('alias-domains-store-down')
    const { wrapper } = await mountList()
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toBe('error')
    expect(wrapper.text()).toContain('The list could not be loaded.')
    mockState().sharedStoreDown = false
    await button(wrapper, 'Try again')!.trigger('click')
    await vi.waitFor(() => expect(names(wrapper)).toHaveLength(3))
  })

  it('keeps the entries and says so when a refresh fails', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    mockState().sharedStoreDown = true
    await button(wrapper, 'Refresh')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('p[role="alert"]').exists()).toBe(true))
    expect(names(wrapper)).toHaveLength(3)
  })

  it('shows the outcome another screen left for the list, once', async () => {
    useScenario('alias-domains-admin')
    setAliasDomainListFlash('danger', 'This alias domain no longer exists.')
    const { wrapper } = await mountList()
    expect(alert(wrapper).text()).toContain('This alias domain no longer exists.')
    expect(alert(wrapper).attributes('data-alert')).toBe('danger')
    const again = await mountList()
    expect(alert(again.wrapper).exists()).toBe(false)
  })
})

describe('AliasDomainsPage: deleting one alias domain', () => {
  it("asks with legacy's texts and the impact, deletes with the version, and says so", async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    await remove(wrapper, 'example.net')
    const dialog = await vi.waitFor(() =>
      document.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"]')!,
    )
    expect(dialog.textContent).toContain('Confirm deletion')
    expect(dialog.querySelector('[data-alias-domain-delete]')!.textContent).toContain(
      'Deleted with it: its aliases (7)',
    )
    const deleteNow = [...dialog.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'Delete now',
    )!
    deleteNow.click()
    await vi.waitFor(() => expect(alert(wrapper).exists()).toBe(true))
    expect(alert(wrapper).text()).toContain('Alias domain example.net has been removed')
    expect(requests('deleteAliasDomain')[0]!.headers['if-match']).toBeTruthy()
    await vi.waitFor(() => expect(names(wrapper)).not.toContain('example.net'))
  })

  it('deletes nothing when cancelled', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    await remove(wrapper, 'example.net')
    settleConfirm(false)
    await flushPromises()
    expect(requests('deleteAliasDomain')).toHaveLength(0)
    expect(alert(wrapper).exists()).toBe(false)
  })

  it('asks again with the reloaded alias domain when it changed in the meantime', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    applyOverrides(mockState(), {
      changeElsewhere: { aliasDomain: { 'example.net': { active: false } } },
    })
    await remove(wrapper, 'example.net')
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(confirmState.value?.description).toBe(
        'The alias domain changed in the meantime. Check it and confirm again.',
      ),
    )
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(alert(wrapper).text()).toContain('Alias domain example.net has been removed'),
    )
    expect(requests('deleteAliasDomain').map((request) => request.status)).toEqual([412, 204])
  })

  it('says the alias domain no longer exists when it vanished', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    applyOverrides(mockState(), { deleteElsewhere: { aliasDomain: ['example.net'] } })
    await remove(wrapper, 'example.net')
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(alert(wrapper).text()).toContain(
        'This alias domain no longer exists or is no longer available to you.',
      ),
    )
  })

  it('says it is gone when the reload after a changed version finds nothing', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    applyOverrides(mockState(), {
      changeElsewhere: { aliasDomain: { 'example.net': { active: false } } },
    })
    mockState().failures.getAliasDomain = { status: 404, type: 'not-found' }
    await remove(wrapper, 'example.net')
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(alert(wrapper).text()).toContain('This alias domain no longer exists'),
    )
  })

  it("shows a refusal as legacy's danger alert and keeps the entry", async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    mockState().sharedStoreDown = true
    await remove(wrapper, 'example.net')
    settleConfirm(true)
    await vi.waitFor(() => expect(alert(wrapper).attributes('data-alert')).toBe('danger'))
    expect(alert(wrapper).text()).not.toContain('has been removed')
  })
})

describe('AliasDomainsPage: mass actions', () => {
  it('deactivates the selection after one confirmation, with a result per alias domain', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    await select(wrapper, 'example.net', 'example.eu')
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'deactivate')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Deactivate'))
    expect(confirmState.value?.description).toContain('Selected alias domains: 2')
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.find('[data-bulk-summary]').exists()).toBe(true))
    const body = requests('applyAliasDomainBulkAction')[0]!.body as {
      action: string
      targets: { id: string; version: string }[]
    }
    expect(body.action).toBe('deactivate')
    expect(body.targets.map((target) => target.id).sort()).toEqual(['example.eu', 'example.net'])
    expect(body.targets.every((target) => !target.version.includes('"'))).toBe(true)
    expect(wrapper.get('[data-bulk-summary]').text()).toContain(
      'Changes to alias domain example.net have been saved',
    )
    await button(wrapper, 'Close')!.trigger('click')
    expect(wrapper.find('[data-bulk-summary]').exists()).toBe(false)
  })

  it('activates without asking', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    await select(wrapper, 'example.net')
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'activate')
    await vi.waitFor(() => expect(requests('applyAliasDomainBulkAction')).toHaveLength(1))
    expect(confirmState.value).toBeNull()
  })

  it('deletes the selection after the number is typed, naming the aliases deleted with it', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList()
    await select(wrapper, 'example.net', 'legacy.example')
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'delete')
    await vi.waitFor(() => expect(confirmState.value?.requireTyped?.accepted).toEqual(['2']))
    const content = confirmState.value!.content!.props as { names: string[]; lines: string[] }
    expect(content.names).toEqual(['example.net', 'legacy.example'])
    expect(content.lines[0]).toContain('their aliases (7)')
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(wrapper.get('[data-bulk-summary]').text()).toContain(
        'Alias domain example.net has been removed',
      ),
    )
  })

  it('keeps the failed alias domains selected with their message, and retries them', async () => {
    useScenario('bulk-alias-domains-failures')
    const { wrapper } = await mountList('/alias-domains?q=brand')
    await vi.waitFor(() => expect(names(wrapper)).toHaveLength(5))
    await button(wrapper, 'Select')!.trigger('click')
    await wrapper.get('th input[type="checkbox"]').setValue(true)
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'activate')
    await vi.waitFor(() => expect(wrapper.find('[data-bulk-summary]').exists()).toBe(true))
    const summary = wrapper.get('[data-bulk-summary]').text()
    expect(summary).toContain('brand-b.example')
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(2)
    mockState().domainFailures = {}
    await button(wrapper, 'Retry the failed ones')!.trigger('click')
    await vi.waitFor(() => expect(requests('applyAliasDomainBulkAction')).toHaveLength(2))
    const retried = requests('applyAliasDomainBulkAction')[1]!.body as { targets: { id: string }[] }
    expect(retried.targets.map((target) => target.id).sort()).toEqual([
      'brand-b.example',
      'brand-d.example',
    ])
  })

  it('selects the page from the narrow "Toggle all" and leaves selection mode', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountList('/alias-domains', false)
    await button(wrapper, 'Select')!.trigger('click')
    await wrapper.get('input[aria-label="Toggle all"]').setValue(true)
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(3)
    await wrapper.get('input[aria-label="Toggle all"]').setValue(false)
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(0)
    await button(wrapper, 'Done selecting')!.trigger('click')
    expect(wrapper.findComponent(BulkActionBar).exists()).toBe(false)
  })
})

// The alias list (US1, US3, US6; FR-005 to FR-017, FR-029 to FR-032, FR-056 to FR-060): the classic
// table, newest first, with legacy's hint; the search, filters, sort and page in the address with
// their chips; the empty, no-match and error states; the single deletion and "Expand alias over
// alias domains" with legacy's alerts (done, changed in the meantime, vanished, refused); and
// selection mode with the mass actions, their confirmations, one result per alias with the copies,
// the bulk limit and a lost connection. The end-to-end suite covers the same flows in the browser.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import AliasEntryActions from '@/features/aliases/components/AliasEntryActions.vue'
import { setAliasListFlash } from '@/features/aliases/flash'
import AliasesPage from '@/features/aliases/pages/AliasesPage.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, server, useScenario } from '../../../mocks/node'
import { applyOverrides } from '../../../mocks/scenarios'
import { ALIASES_60 } from '../../../mocks/scenarios/aliases-list'
import { BULK_004 } from '../../../mocks/scenarios/bulk-004'
import { confirmDialog, dialogButton, mountPage } from '../aliases-common/page-support'

async function mountList(path = '/aliases', wide = true) {
  const { wrapper, router } = await mountPage(AliasesPage, 'aliases', path, { wide })
  await vi.waitFor(() =>
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).not.toBe('loading'),
  )
  await flushPromises()
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountList>>['wrapper']

const ids = (wrapper: Wrapper) =>
  wrapper.findAll('[data-entry]').map((item) => Number(item.attributes('data-entry')))

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)

const alert = (wrapper: Wrapper) => wrapper.find('[data-alert]')

/** A filter chip's remove button, named by its label or, for a chip with legacy markup, its text. */
const chip = (wrapper: Wrapper, label: string) =>
  wrapper
    .findAll('button')
    .find(
      (item) =>
        item.attributes('aria-label')?.includes(label) ||
        (!item.attributes('aria-label') && item.text().trim().endsWith(label)),
    )

/** The entry menu's Remove or "Expand alias over alias domains", as the menu emits them. */
async function act(wrapper: Wrapper, event: 'delete' | 'copy', id: number) {
  const actions = wrapper
    .findAllComponents(AliasEntryActions)
    .find((item) => item.props('alias').id === id)!
  actions.vm.$emit(event, actions.props('alias'))
  await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
}

async function select(wrapper: Wrapper, ...addresses: string[]) {
  await button(wrapper, 'Select')!.trigger('click')
  for (const address of addresses) {
    await wrapper.get(`input[aria-label="Select ${address}"]`).setValue(true)
  }
}

async function bulk(wrapper: Wrapper, action: string) {
  wrapper.getComponent(BulkActionBar).vm.$emit('action', action)
  await flushPromises()
}

describe('AliasesPage: the list', () => {
  it("shows the newest aliases first with legacy's hint, Add, Select and Refresh", async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    expect(wrapper.get('h1').text()).toBe('Aliases')
    expect(ids(wrapper)).toHaveLength(25)
    expect(ids(wrapper).slice(0, 3)).toEqual([60, 59, 58])
    expect(wrapper.text()).toContain('Aliases are not applied on domain aliases automatically.')
    expect(wrapper.find('a[href="/ng/aliases/new"]').text()).toContain('Add alias')
    expect(button(wrapper, 'Select')).toBeDefined()
    await button(wrapper, 'Refresh')!.trigger('click')
    await vi.waitFor(() => expect(requests('listAliases').length).toBeGreaterThan(1))
  })

  it('pages and resizes through the address', async () => {
    useScenario('aliases-60')
    const { wrapper, router } = await mountList()
    wrapper.getComponent(PaginationBar).vm.$emit('update:page', 2)
    await vi.waitFor(() => expect(router.currentRoute.value.query.page).toBe('2'))
    await vi.waitFor(() => expect(ids(wrapper)[0]).toBe(35))
    wrapper.getComponent(PaginationBar).vm.$emit('update:size', 100)
    await vi.waitFor(() => expect(ids(wrapper)).toHaveLength(60))
    expect(router.currentRoute.value.query.page).toBeUndefined()
  })

  it('leaves out orphaned aliases and other domains for a domain administrator', async () => {
    useScenario('aliases-da-two-of-ten')
    const { wrapper } = await mountList('/aliases?size=100')
    expect(ids(wrapper)).not.toContain(ALIASES_60.orphaned)
    expect(ids(wrapper)).not.toContain(ALIASES_60.otherDomain)
    expect(ids(wrapper)).toContain(ALIASES_60.sales)
  })

  it('searches the address, destinations and comments through the address', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList('/aliases?q=invoice')
    expect(ids(wrapper)).toEqual([
      ALIASES_60.invoiceAddress,
      ALIASES_60.invoiceDestination,
      ALIASES_60.invoiceComment,
    ])
  })

  it('sorts from the table headers and from the narrow sort control', async () => {
    useScenario('aliases-60')
    const { wrapper, router } = await mountList()
    const header = wrapper.findAll('th button').find((item) => item.text().startsWith('Alias'))!
    await header.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.sort).toBe('address'))
    const narrow = await mountList('/aliases', false)
    expect(narrow.wrapper.find('table').exists()).toBe(false)
    await narrow.wrapper.get('#alias-sort').setValue('createdAt')
    await vi.waitFor(() => expect(narrow.router.currentRoute.value.query.sort).toBe('createdAt'))
    await narrow.wrapper.get('#alias-order').setValue('desc')
    await vi.waitFor(() => expect(narrow.router.currentRoute.value.query.order).toBe('desc'))
  })

  it('filters by kind and destination type from the panel and names them in chips', async () => {
    useScenario('aliases-60')
    const { wrapper, router } = await mountList()
    await button(wrapper, 'Filters')!.trigger('click')
    const spam = wrapper
      .findAll('#alias-filters label')
      .find((item) => item.text() === 'Learn as spam')!
    await spam.get('input').setValue(true)
    await vi.waitFor(() =>
      expect([router.currentRoute.value.query.destinationType].flat()).toEqual(['learnSpam']),
    )
    await vi.waitFor(() => expect(ids(wrapper)).toEqual([ALIASES_60.learnSpam]))
    await chip(wrapper, 'Learn as spam')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.destinationType).toBeUndefined())
    const { wrapper: catchAll } = await mountList('/aliases?kind=catchAll')
    expect(ids(catchAll)).toEqual([ALIASES_60.catchAll])
    await chip(catchAll, 'Catch-All')!.trigger('click')
    await vi.waitFor(() => expect(ids(catchAll)).toHaveLength(25))
  })

  it('filters by the flags and names each in a chip, the groupware one only with the groupware', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList('/aliases?senderAllowed=false&internal=false')
    expect(ids(wrapper)).toEqual([ALIASES_60.receiveOnly])
    expect(wrapper.text()).toContain('Allow to send as this alias: No')
    expect(wrapper.text()).toContain('Internal: No')
    const visible = await mountList('/aliases?groupwareVisible=false&active=true')
    expect(ids(visible.wrapper)).toEqual([ALIASES_60.hidden])
    expect(visible.wrapper.text()).toContain('Alias is visible in SOGo: No')
    await chip(visible.wrapper, 'Alias is visible in SOGo: No')!.trigger('click')
    await vi.waitFor(() =>
      expect(visible.router.currentRoute.value.query.groupwareVisible).toBeUndefined(),
    )
  })

  it('ignores the groupware filter and sort while the groupware is disabled', async () => {
    useScenario('aliases-groupware-disabled')
    const { wrapper } = await mountList('/aliases?groupwareVisible=false&sort=groupwareVisible')
    expect(wrapper.text()).not.toContain('Alias is visible in SOGo: No')
    const query = requests('listAliases').at(-1)!.path
    expect(query).not.toContain('groupwareVisible')
    expect(query).toContain('sort=id')
  })

  it('names the domain, target domain and destination filters of the address in chips', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList(
      '/aliases?domain=example.net&primaryDomain=example.org&destination=anna@example.org',
    )
    expect(ids(wrapper)).toEqual([ALIASES_60.infoNet])
    expect(wrapper.text()).toContain('Domain: example.net')
    expect(wrapper.text()).toContain('Target domain: example.org')
    expect(wrapper.text()).toContain('Goto address: anna@example.org')
    await chip(wrapper, 'Goto address: anna@example.org')!.trigger('click')
    await chip(wrapper, 'Domain: example.net')!.trigger('click')
    await vi.waitFor(() => expect(ids(wrapper)).toContain(ALIASES_60.sales))
    await button(wrapper, 'Clear all filters')!.trigger('click')
    await vi.waitFor(() => expect(ids(wrapper)).toHaveLength(25))
  })

  it('offers to clear a search without matches', async () => {
    useScenario('aliases-60')
    const { wrapper, router } = await mountList('/aliases?q=zzz')
    expect(wrapper.get('[data-empty="noMatch"]').text()).toContain('No matching records found')
    await wrapper.get('[data-empty="noMatch"] button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBeUndefined())
    await vi.waitFor(() => expect(ids(wrapper)).toHaveLength(25))
  })

  it('says the table is empty and offers "Add alias"', async () => {
    useScenario('aliases-empty')
    const { wrapper } = await mountList()
    const empty = wrapper.get('[data-empty="none"]')
    expect(empty.text()).toContain('No data available in table')
    expect(empty.find('a[href="/ng/aliases/new"]').exists()).toBe(true)
  })

  it('says the list could not be loaded and retries, and keeps it when a refresh fails', async () => {
    useScenario('aliases-60')
    mockState().failures.listAliases = { status: 500, times: 1 }
    const { wrapper } = await mountList()
    expect(wrapper.text()).toContain('The list could not be loaded.')
    await button(wrapper, 'Try again')!.trigger('click')
    await vi.waitFor(() => expect(ids(wrapper)).toHaveLength(25))
    mockState().failures.listAliases = { status: 500, times: 1 }
    await button(wrapper, 'Refresh')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('The list could not be refreshed.'))
    expect(ids(wrapper)).toHaveLength(25)
  })

  it('shows the outcome another screen left for the list', async () => {
    useScenario('aliases-60')
    setAliasListFlash('danger', 'This alias no longer exists.')
    const { wrapper } = await mountList()
    expect(alert(wrapper).text()).toContain('This alias no longer exists.')
  })
})

describe('AliasesPage: deleting one alias', () => {
  it('asks with the address and the impact, deletes with the version, and says so', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    await act(wrapper, 'delete', ALIASES_60.catchAll)
    const shown = await confirmDialog()
    const impact = shown.querySelector('[data-alias-delete]')!.textContent
    expect(impact).toContain('@example.org')
    expect(impact).toContain('This is a catch-all alias')
    dialogButton(shown, 'Delete now').click()
    await vi.waitFor(() =>
      expect(alert(wrapper).text()).toContain('Alias @example.org has been removed'),
    )
    expect(requests('deleteAlias')[0]!.headers['if-match']).toBeTruthy()
    await vi.waitFor(() => expect(ids(wrapper)).not.toContain(ALIASES_60.catchAll))
  })

  it('asks again with the reloaded alias when it changed in the meantime', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    applyOverrides(mockState(), {
      changeElsewhere: { alias: { [String(ALIASES_60.sales)]: { active: false } } },
    })
    await act(wrapper, 'delete', ALIASES_60.sales)
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(confirmState.value?.description).toBe(
        'The alias changed in the meantime. Check it and confirm again.',
      ),
    )
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(alert(wrapper).text()).toContain('Alias sales@example.org has been removed'),
    )
    expect(requests('deleteAlias').map((request) => request.status)).toEqual([412, 204])
  })

  it('says the alias no longer exists when it vanished, also on the reload after a 412', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    applyOverrides(mockState(), { deleteElsewhere: { alias: [ALIASES_60.sales] } })
    await act(wrapper, 'delete', ALIASES_60.sales)
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(alert(wrapper).text()).toContain(
        'This alias no longer exists or is no longer available to you.',
      ),
    )
    applyOverrides(mockState(), {
      changeElsewhere: { alias: { [String(ALIASES_60.infoNet)]: { active: false } } },
    })
    mockState().failures.getAlias = { status: 404, type: 'not-found' }
    await act(wrapper, 'delete', ALIASES_60.infoNet)
    settleConfirm(true)
    await vi.waitFor(() => expect(requests('getAlias')).toHaveLength(1))
    expect(alert(wrapper).text()).toContain('This alias no longer exists')
  })

  it('shows a refusal as a danger alert and keeps the alias', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    mockState().failures.deleteAlias = { status: 500 }
    await act(wrapper, 'delete', ALIASES_60.sales)
    settleConfirm(true)
    await vi.waitFor(() => expect(alert(wrapper).attributes('data-alert')).toBe('danger'))
    expect(ids(wrapper)).toContain(ALIASES_60.sales)
  })
})

describe('AliasesPage: "Expand alias over alias domains" for one alias', () => {
  it('explains, copies with the version and lists a result per alias domain', async () => {
    useScenario('bulk-004')
    const { wrapper } = await mountList('/aliases?size=50')
    await act(wrapper, 'copy', BULK_004.sales)
    expect(confirmState.value?.description).toBe(
      'A copy of the alias is created in every alias domain of its domain, unless the address is already in use there.',
    )
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.find('[data-copy-results]').exists()).toBe(true))
    expect(requests('copyAliasOverAliasDomains')[0]!.headers['if-match']).toBeTruthy()
    const report = wrapper.get('section[aria-label="Expand alias over alias domains"]')
    expect(report.text()).toContain('Expand alias over alias domains: sales@example.org')
    const copies = report.findAll('[data-copy]').map((item) => item.attributes('data-copy'))
    expect(copies.sort()).toEqual(['created', 'skipped'])
    expect(report.text()).toContain('sales@example.com')
    expect(report.text()).toContain(
      'sales@example.net is already known as an alias, a mailbox or an alias address',
    )
    await report.get('button[aria-label="Close"]').trigger('click')
    expect(wrapper.find('[data-copy-results]').exists()).toBe(false)
  })

  it('explains again with the reloaded alias when it changed in the meantime', async () => {
    useScenario('bulk-004')
    const { wrapper } = await mountList('/aliases?size=50')
    applyOverrides(mockState(), {
      changeElsewhere: { alias: { [String(BULK_004.sales)]: { publicComment: 'Changed' } } },
    })
    await act(wrapper, 'copy', BULK_004.sales)
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(confirmState.value?.description).toBe(
        'The alias changed in the meantime. Check it and confirm again.',
      ),
    )
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.find('[data-copy-results]').exists()).toBe(true))
    expect(requests('copyAliasOverAliasDomains').map((request) => request.status)).toEqual([
      412, 200,
    ])
  })

  it("refuses an alias of an alias domain with legacy's warning", async () => {
    useScenario('bulk-004')
    const { wrapper } = await mountList('/aliases?size=50')
    await act(wrapper, 'copy', BULK_004.inAliasDomain)
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(alert(wrapper).text()).toContain('Skipped non-primary alias info@example.net'),
    )
    expect(wrapper.find('[data-copy-results]').exists()).toBe(false)
  })

  it('says the alias no longer exists when it vanished, and copies nothing when cancelled', async () => {
    useScenario('bulk-004')
    const { wrapper } = await mountList('/aliases?size=50')
    await act(wrapper, 'copy', BULK_004.sales)
    settleConfirm(false)
    await flushPromises()
    expect(requests('copyAliasOverAliasDomains')).toHaveLength(0)
    applyOverrides(mockState(), { deleteElsewhere: { alias: [BULK_004.sales] } })
    await act(wrapper, 'copy', BULK_004.sales)
    settleConfirm(true)
    await vi.waitFor(() => expect(alert(wrapper).text()).toContain('This alias no longer exists'))
  })

  it('says the alias is gone when the reload after a changed version finds nothing', async () => {
    useScenario('bulk-004')
    const { wrapper } = await mountList('/aliases?size=50')
    applyOverrides(mockState(), {
      changeElsewhere: { alias: { [String(BULK_004.sales)]: { active: false } } },
    })
    mockState().failures.getAlias = { status: 404, type: 'not-found' }
    await act(wrapper, 'copy', BULK_004.sales)
    settleConfirm(true)
    await vi.waitFor(() => expect(alert(wrapper).text()).toContain('This alias no longer exists'))
  })
})

describe('AliasesPage: mass actions', () => {
  it('deactivates the selection after one confirmation, with a result per alias', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    await select(wrapper, 'sales@example.org', 'info@example.net')
    await bulk(wrapper, 'deactivate')
    expect(confirmState.value?.title).toBe('Deactivate')
    expect(confirmState.value?.description).toContain('Selected aliases: 2')
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.find('[data-bulk-summary]').exists()).toBe(true))
    const body = requests('applyAliasBulkAction')[0]!.body as { targets: { id: string }[] }
    expect(body.targets.map((target) => target.id)).toEqual(['60', '59'])
    expect(wrapper.get('[data-bulk-summary]').text()).toContain(
      'Changes to alias address sales@example.org have been saved',
    )
  })

  it('hides in SOGo after one confirmation and shows without asking', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    await select(wrapper, 'sales@example.org')
    expect(
      wrapper
        .getComponent(BulkActionBar)
        .props('actions')
        .map((a: { id: string }) => a.id),
    ).toEqual([
      'activate',
      'deactivate',
      'showInGroupware',
      'hideInGroupware',
      'copyOverAliasDomains',
      'delete',
    ])
    await bulk(wrapper, 'hideInGroupware')
    expect(confirmState.value?.description).toContain(
      'While they are hidden, SOGo does not offer them as sender addresses.',
    )
    settleConfirm(true)
    await vi.waitFor(() => expect(requests('applyAliasBulkAction')).toHaveLength(1))
    await button(wrapper, 'Close')!.trigger('click')
    await wrapper.get('input[aria-label="Select sales@example.org"]').setValue(true)
    await bulk(wrapper, 'showInGroupware')
    await vi.waitFor(() => expect(requests('applyAliasBulkAction')).toHaveLength(2))
    expect(confirmState.value).toBeNull()
  })

  it('offers no groupware actions while the groupware is disabled', async () => {
    useScenario('aliases-groupware-disabled')
    const { wrapper } = await mountList()
    await select(wrapper, 'sales@example.org')
    const actions = wrapper
      .getComponent(BulkActionBar)
      .props('actions')
      .map((a: { id: string }) => a.id)
    expect(actions).not.toContain('showInGroupware')
    expect(actions).not.toContain('hideInGroupware')
  })

  it('copies the selection over the alias domains and lists the copies of each alias', async () => {
    useScenario('bulk-004')
    const { wrapper } = await mountList('/aliases?size=50')
    await select(wrapper, 'sales@example.org', 'info@example.net')
    await bulk(wrapper, 'copyOverAliasDomains')
    expect(confirmState.value?.title).toBe('Expand alias over alias domains')
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.find('[data-bulk-summary]').exists()).toBe(true))
    const summary = wrapper.get('[data-bulk-summary]')
    expect(summary.find('[data-copy-results]').exists()).toBe(true)
    expect(summary.text()).toContain('Skipped non-primary alias info@example.net')
    // The refused alias stays selected for a retry.
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(1)
  })

  it('deletes the selection after the number is typed', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    await select(wrapper, 'sales@example.org', 'info@example.net', '@example.org')
    await bulk(wrapper, 'delete')
    const shown = await confirmDialog()
    expect(shown.textContent).toContain('Mail to these addresses is no longer accepted')
    const typed = shown.querySelector<HTMLInputElement>('input')!
    typed.value = '3'
    typed.dispatchEvent(new Event('input'))
    await flushPromises()
    dialogButton(shown, 'Delete now').click()
    await vi.waitFor(() =>
      expect(wrapper.get('[data-bulk-summary]').text()).toContain(
        'Alias sales@example.org has been removed',
      ),
    )
  })

  it('selects the page up to the bulk limit and says so', async () => {
    useScenario('bulk-limit-50')
    const { wrapper } = await mountList('/aliases?size=100')
    await button(wrapper, 'Select')!.trigger('click')
    await wrapper.get('th input[type="checkbox"]').setValue(true)
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(50)
    expect(wrapper.getComponent(BulkActionBar).props('limitMessage')).toBe(
      'You can select at most 50 items for one action.',
    )
    await wrapper.get('th input[type="checkbox"]').setValue(false)
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(0)
  })

  it('reports every alias as "outcome unknown" after a lost connection, and keeps them selected', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    await select(wrapper, 'sales@example.org', 'info@example.net')
    server.use(
      http.post('*/api/v2/aliases/bulk-actions', () => HttpResponse.error(), { once: true }),
    )
    const before = requests('listAliases').length
    await bulk(wrapper, 'activate')
    await vi.waitFor(() => expect(wrapper.find('[data-bulk-summary]').exists()).toBe(true))
    expect(wrapper.get('[data-bulk-summary]').text()).toContain('Outcome unknown')
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(2)
    await vi.waitFor(() => expect(requests('listAliases').length).toBeGreaterThan(before))
  })

  it('shows a refusal of the whole action', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList()
    await select(wrapper, 'sales@example.org')
    mockState().failures.applyAliasBulkAction = { status: 500, times: 1 }
    await bulk(wrapper, 'activate')
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('[data-bulk-summary]').exists()).toBe(false)
  })

  it('selects the page from the narrow "Toggle all" and leaves selection mode', async () => {
    useScenario('aliases-60')
    const { wrapper } = await mountList('/aliases', false)
    await button(wrapper, 'Select')!.trigger('click')
    await wrapper.get('input[aria-label="Toggle all"]').setValue(true)
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(25)
    await button(wrapper, 'Done selecting')!.trigger('click')
    expect(wrapper.findComponent(BulkActionBar).exists()).toBe(false)
  })
})

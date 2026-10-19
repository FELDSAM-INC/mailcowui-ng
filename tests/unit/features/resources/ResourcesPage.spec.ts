// The resource list (US7, US6; FR-042, FR-043, FR-029, FR-030, FR-056 to FR-060): the classic table
// with the booking legend, the search, the domain, kind and active filters and the sort in the
// address with their chips, the empty, no-match and error states, the single deletion with legacy's
// alerts (deleted, changed in the meantime, vanished, refused), and selection mode with activate,
// deactivate (one confirmation) and delete (the typed count). The end-to-end suite covers the same
// flows in the browser.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ResourceEntryActions from '@/features/resources/components/ResourceEntryActions.vue'
import { setResourceListFlash } from '@/features/resources/flash'
import ResourcesPage from '@/features/resources/pages/ResourcesPage.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { applyOverrides } from '../../../mocks/scenarios'
import { RESOURCES_004 } from '../../../mocks/scenarios/resources'
import { confirmDialog, dialogButton, mountPage } from '../aliases-common/page-support'

const ALL = [
  RESOURCES_004.boardRoom,
  ...RESOURCES_004.desks,
  RESOURCES_004.meetingRoom,
  RESOURCES_004.projector,
  RESOURCES_004.teamCalendar,
  RESOURCES_004.van,
]

async function mountList(path = '/resources', wide = true) {
  const { wrapper, router } = await mountPage(ResourcesPage, 'resources', path, { wide })
  await vi.waitFor(() =>
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).not.toBe('loading'),
  )
  await flushPromises()
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountList>>['wrapper']

const addresses = (wrapper: Wrapper) =>
  wrapper.findAll('[data-entry]').map((item) => item.attributes('data-entry'))

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)

const alert = (wrapper: Wrapper) => wrapper.find('[data-alert]')

async function remove(wrapper: Wrapper, address: string) {
  const actions = wrapper
    .findAllComponents(ResourceEntryActions)
    .find((item) => item.props('resource').address === address)!
  actions.vm.$emit('delete', actions.props('resource'))
  await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
}

async function select(wrapper: Wrapper, ...entries: string[]) {
  await button(wrapper, 'Select')!.trigger('click')
  for (const address of entries) {
    await wrapper.get(`input[aria-label="Select ${address}"]`).setValue(true)
  }
}

describe('ResourcesPage: the list', () => {
  it("shows legacy's table by description with the booking legend, Add and Refresh", async () => {
    useScenario('resources')
    const { wrapper } = await mountList()
    expect(wrapper.get('h1').text()).toBe('Resources')
    expect(addresses(wrapper)).toEqual(ALL)
    expect(wrapper.find('[data-booking-legend]').exists()).toBe(true)
    expect(wrapper.get('[data-entry="TeamCalendar@other.example"]').text()).toContain(
      'Hard limit (2)',
    )
    expect(wrapper.find('a[href="/ng/resources/new"]').text()).toContain('Add resource')
    await button(wrapper, 'Refresh')!.trigger('click')
    await vi.waitFor(() => expect(requests('listResources').length).toBeGreaterThan(1))
  })

  it("lists a domain administrator's resources only", async () => {
    useScenario('resources-da')
    const { wrapper } = await mountList()
    expect(addresses(wrapper)).toEqual(ALL.filter((item) => item !== RESOURCES_004.teamCalendar))
    expect(wrapper.find('a[href="/ng/resources/new"]').exists()).toBe(true)
  })

  it('sorts from the table headers and from the narrow sort control', async () => {
    useScenario('resources')
    const { wrapper, router } = await mountList()
    const header = wrapper.findAll('th button').find((item) => item.text().includes('Kind'))!
    await header.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.sort).toBe('kind'))
    const narrow = await mountList('/resources', false)
    expect(narrow.wrapper.find('table').exists()).toBe(false)
    await narrow.wrapper.get('#resource-sort').setValue('domain')
    await vi.waitFor(() => expect(narrow.router.currentRoute.value.query.sort).toBe('domain'))
    await narrow.wrapper.get('#resource-order').setValue('desc')
    await vi.waitFor(() => expect(narrow.router.currentRoute.value.query.order).toBe('desc'))
  })

  it('filters by kind and active through the address and names each filter in a chip', async () => {
    useScenario('resources')
    const { wrapper, router } = await mountList()
    await button(wrapper, 'Filters')!.trigger('click')
    const thing = wrapper
      .findAll('#resource-filters label')
      .find((item) => item.text() === 'Thing')!
    await thing.get('input').setValue(true)
    await vi.waitFor(() => expect([router.currentRoute.value.query.kind].flat()).toEqual(['thing']))
    await wrapper.get('#resource-filter-active').setValue('false')
    await vi.waitFor(() => expect(router.currentRoute.value.query.active).toBe('false'))
    await vi.waitFor(() => expect(addresses(wrapper)).toEqual([RESOURCES_004.van]))
    expect(wrapper.text()).toContain('Kind: Thing')
    expect(wrapper.text()).toContain('Active: No')
    const chip = wrapper
      .findAll('button')
      .find((item) => item.attributes('aria-label')?.includes('Kind: Thing'))!
    await chip.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.kind).toBeUndefined())
    await wrapper.get('#resource-filter-active').setValue('')
    await vi.waitFor(() => expect(addresses(wrapper)).toHaveLength(ALL.length))
  })

  it('names a domain filter of the address in a chip and clears all filters', async () => {
    useScenario('resources')
    const { wrapper } = await mountList('/resources?domain=example.com&kind=thing')
    await vi.waitFor(() =>
      expect(addresses(wrapper)).toEqual([RESOURCES_004.projector, RESOURCES_004.van]),
    )
    expect(wrapper.text()).toContain('Domain: example.com')
    await button(wrapper, 'Clear all filters')!.trigger('click')
    await vi.waitFor(() => expect(addresses(wrapper)).toHaveLength(ALL.length))
  })

  it('offers to clear a search without matches', async () => {
    useScenario('resources')
    const { wrapper, router } = await mountList('/resources?q=zzz')
    expect(wrapper.get('[data-empty="noMatch"]').text()).toContain('No matching records found')
    await wrapper.get('[data-empty="noMatch"] button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBeUndefined())
    await vi.waitFor(() => expect(addresses(wrapper)).toHaveLength(ALL.length))
  })

  it('says the table is empty and offers "Add resource"', async () => {
    useScenario('resources')
    mockState().resources = []
    const { wrapper } = await mountList()
    const empty = wrapper.get('[data-empty="none"]')
    expect(empty.text()).toContain('No data available in table')
    expect(empty.find('a[href="/ng/resources/new"]').exists()).toBe(true)
  })

  it('says the list could not be loaded and retries', async () => {
    useScenario('resources')
    mockState().failures.listResources = { status: 500, times: 1 }
    const { wrapper } = await mountList()
    expect(wrapper.text()).toContain('The list could not be loaded.')
    await button(wrapper, 'Try again')!.trigger('click')
    await vi.waitFor(() => expect(addresses(wrapper)).toHaveLength(ALL.length))
  })

  it('keeps the entries and says so when a refresh fails', async () => {
    useScenario('resources')
    const { wrapper } = await mountList()
    mockState().failures.listResources = { status: 500, times: 1 }
    await button(wrapper, 'Refresh')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('The list could not be refreshed.'))
    expect(addresses(wrapper)).toHaveLength(ALL.length)
  })

  it('shows the outcome another screen left for the list', async () => {
    useScenario('resources')
    setResourceListFlash('danger', 'This resource no longer exists.')
    const { wrapper } = await mountList()
    expect(alert(wrapper).text()).toContain('This resource no longer exists.')
    await alert(wrapper).get('button').trigger('click')
    expect(alert(wrapper).exists()).toBe(false)
  })
})

describe('ResourcesPage: deleting one resource', () => {
  it('asks with the description, the address and the impact, deletes, and says so', async () => {
    useScenario('resources')
    const { wrapper } = await mountList()
    await remove(wrapper, RESOURCES_004.meetingRoom)
    const shown = await confirmDialog()
    expect(shown.querySelector('[data-resource-delete]')!.textContent).toContain(
      'Meeting Room 1 (MeetingRoom1@example.org)',
    )
    expect(shown.textContent).toContain('Its calendar, its bookings and its sharing settings')
    dialogButton(shown, 'Delete now').click()
    await vi.waitFor(() =>
      expect(alert(wrapper).text()).toContain('Resource MeetingRoom1@example.org has been removed'),
    )
    expect(requests('deleteResource')[0]!.headers['if-match']).toBeTruthy()
    await vi.waitFor(() => expect(addresses(wrapper)).not.toContain(RESOURCES_004.meetingRoom))
  })

  it('asks again with the reloaded resource when it changed in the meantime', async () => {
    useScenario('resources')
    const { wrapper } = await mountList()
    applyOverrides(mockState(), {
      changeElsewhere: { resource: { [RESOURCES_004.projector]: { active: false } } },
    })
    await remove(wrapper, RESOURCES_004.projector)
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(confirmState.value?.description).toBe(
        'The resource changed in the meantime. Check it and confirm again.',
      ),
    )
    settleConfirm(true)
    await vi.waitFor(() => expect(alert(wrapper).text()).toContain('has been removed'))
    expect(requests('deleteResource').map((request) => request.status)).toEqual([412, 204])
  })

  it('says the resource no longer exists when it vanished, also on the reload after a 412', async () => {
    useScenario('resources')
    const { wrapper } = await mountList()
    applyOverrides(mockState(), { deleteElsewhere: { resource: [RESOURCES_004.van] } })
    await remove(wrapper, RESOURCES_004.van)
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(alert(wrapper).text()).toContain(
        'This resource no longer exists or is no longer available to you.',
      ),
    )
    applyOverrides(mockState(), {
      changeElsewhere: { resource: { [RESOURCES_004.projector]: { active: false } } },
    })
    mockState().failures.getResource = { status: 404, type: 'not-found' }
    await remove(wrapper, RESOURCES_004.projector)
    settleConfirm(true)
    await vi.waitFor(() => expect(requests('getResource')).toHaveLength(1))
    expect(alert(wrapper).text()).toContain('This resource no longer exists')
  })

  it('shows a refusal as a danger alert and keeps the resource', async () => {
    useScenario('resources')
    const { wrapper } = await mountList()
    mockState().failures.deleteResource = { status: 500 }
    await remove(wrapper, RESOURCES_004.van)
    settleConfirm(true)
    await vi.waitFor(() => expect(alert(wrapper).attributes('data-alert')).toBe('danger'))
    expect(addresses(wrapper)).toContain(RESOURCES_004.van)
  })
})

describe('ResourcesPage: mass actions', () => {
  it('deactivates the selection after one confirmation, with a result per resource', async () => {
    useScenario('resources')
    const { wrapper } = await mountList()
    await select(wrapper, RESOURCES_004.meetingRoom, RESOURCES_004.projector)
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'deactivate')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Deactivate'))
    expect(confirmState.value?.description).toContain('Selected resources: 2')
    expect((confirmState.value!.content!.props as { names: string[] }).names).toEqual([
      'Meeting Room 1 (MeetingRoom1@example.org)',
      'Projector (Projector@example.com)',
    ])
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.find('[data-bulk-summary]').exists()).toBe(true))
    expect(wrapper.get('[data-bulk-summary]').text()).toContain(
      'Changes to mailbox MeetingRoom1@example.org have been saved',
    )
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(0)
  })

  it('activates without asking', async () => {
    useScenario('resources')
    const { wrapper } = await mountList()
    await select(wrapper, RESOURCES_004.van)
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'activate')
    await vi.waitFor(() => expect(requests('applyResourceBulkAction')).toHaveLength(1))
    expect(confirmState.value).toBeNull()
  })

  it('deletes the five desks after their number is typed', async () => {
    useScenario('resources')
    const { wrapper } = await mountList('/resources?q=desk')
    await vi.waitFor(() => expect(addresses(wrapper)).toEqual([...RESOURCES_004.desks]))
    await button(wrapper, 'Select')!.trigger('click')
    await wrapper.get('th input[type="checkbox"]').setValue(true)
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'delete')
    const shown = await confirmDialog()
    expect(shown.textContent).toContain('Their calendars, bookings and sharing settings')
    const deleteNow = dialogButton(shown, 'Delete now')
    expect(deleteNow.disabled).toBe(true)
    const typed = shown.querySelector<HTMLInputElement>('input')!
    typed.value = '5'
    typed.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(deleteNow.disabled).toBe(false)
    deleteNow.click()
    await vi.waitFor(() =>
      expect(wrapper.get('[data-bulk-summary]').text()).toContain(
        'Resource Desk1@example.org has been removed',
      ),
    )
    expect(requests('applyResourceBulkAction')[0]!.body).toMatchObject({ action: 'delete' })
  })

  it('keeps an outdated resource selected and refreshes the list on request', async () => {
    useScenario('resources')
    const { wrapper } = await mountList()
    await select(wrapper, RESOURCES_004.meetingRoom, RESOURCES_004.projector)
    applyOverrides(mockState(), {
      changeElsewhere: { resource: { [RESOURCES_004.projector]: { description: 'Beamer' } } },
    })
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'activate')
    await vi.waitFor(() => expect(wrapper.find('[data-bulk-summary]').exists()).toBe(true))
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(1)
    const before = requests('listResources').length
    await button(wrapper, 'Refresh the list')!.trigger('click')
    await vi.waitFor(() => expect(requests('listResources').length).toBeGreaterThan(before))
  })

  it('selects the page from the narrow "Toggle all"', async () => {
    useScenario('resources')
    const { wrapper } = await mountList('/resources', false)
    await button(wrapper, 'Select')!.trigger('click')
    await wrapper.get('input[aria-label="Toggle all"]').setValue(true)
    expect(wrapper.getComponent(BulkActionBar).props('count')).toBe(ALL.length)
    await button(wrapper, 'Done selecting')!.trigger('click')
    expect(wrapper.findComponent(BulkActionBar).exists()).toBe(false)
  })
})

// The resource page (US7, FR-046, FR-048, FR-026 to FR-028; `templates/edit/resource.twig`):
// legacy's heading with the address, the creation's message, the address and domain read-only, the
// "Resource" section opened by `?edit=resource` with the client checks, only the changed members
// saved (the booking limit only for a hard limit) and legacy's message, the marks after a 412,
// legacy's messages for refused fields, the return to the list when the resource vanishes, History
// for administrators, "not found" and the load error.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { setResourceFlash, takeResourceListFlash } from '@/features/resources/flash'
import ResourceDetailPage from '@/features/resources/pages/ResourceDetailPage.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { applyOverrides } from '../../../mocks/scenarios'
import { RESOURCES_004 } from '../../../mocks/scenarios/resources'
import { testPlugins } from '../../support/mount'
import { mountPage } from '../aliases-common/page-support'

const ROOM = RESOURCES_004.meetingRoom

async function mountDetail(path = `/resources/${ROOM}`, wide = true) {
  const mounted = await mountPage(ResourceDetailPage, 'resource-detail', path, { wide })
  await vi.waitFor(() => expect(mounted.wrapper.find('[data-page-loading]').exists()).toBe(false))
  await flushPromises()
  return mounted
}

type Wrapper = Awaited<ReturnType<typeof mountDetail>>['wrapper']

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)

const field = (wrapper: Wrapper, name: string) => wrapper.get(`[data-field="${name}"]`).text()

async function save(wrapper: Wrapper) {
  await wrapper.get('#section-resource form').trigger('submit')
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.text()).not.toContain('Saving…'))
  await flushPromises()
}

describe('ResourceDetailPage: reading', () => {
  it("shows legacy's heading, the address, the domain, the section's values and History", async () => {
    useScenario('resources')
    const { wrapper } = await mountDetail(`/resources/${RESOURCES_004.teamCalendar}`)
    expect(wrapper.get('h1').text()).toBe('Resource')
    expect(field(wrapper, 'address')).toBe(RESOURCES_004.teamCalendar)
    expect(field(wrapper, 'domain')).toBe('other.example')
    expect(field(wrapper, 'description')).toBe('Team Calendar')
    expect(field(wrapper, 'kind')).toBe('Group')
    expect(field(wrapper, 'bookingRule')).toContain('Hard limit (2)')
    expect(field(wrapper, 'active')).toContain('Yes')
    expect(wrapper.findAll('a').some((link) => link.text() === 'History')).toBe(true)
  })

  it('shows no History to a domain administrator', async () => {
    useScenario('resources-da')
    const { wrapper } = await mountDetail()
    expect(field(wrapper, 'description')).toBe('Meeting Room 1')
    expect(wrapper.findAll('a').some((link) => link.text() === 'History')).toBe(false)
  })

  it('shows the message of the creation that opened it, once', async () => {
    useScenario('resources')
    setResourceFlash(ROOM, 'Resource MeetingRoom1@example.org has been added')
    const { wrapper } = await mountDetail()
    expect(wrapper.get('[data-alert]').text()).toContain(
      'Resource MeetingRoom1@example.org has been added',
    )
    await wrapper.get('[data-alert] button').trigger('click')
    expect(wrapper.find('[data-alert]').exists()).toBe(false)
  })

  it('drops an unknown section from the address', async () => {
    useScenario('resources')
    const { router } = await mountDetail(`/resources/${ROOM}?edit=general`)
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
  })

  it('shows "not found" with the way back for a resource outside the scope', async () => {
    useScenario('resources-da')
    const { wrapper } = await mountDetail(`/resources/${RESOURCES_004.teamCalendar}`)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Page not found'))
    expect(wrapper.text()).toContain('Back to the list')
  })

  it('says the resource could not be loaded and retries', async () => {
    useScenario('resources')
    mockState().failures.getResource = { status: 500, times: 1 }
    const { wrapper } = await mountDetail()
    await vi.waitFor(() => expect(wrapper.text()).toContain('This item could not be loaded.'))
    await button(wrapper, 'Try again')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('#section-resource').exists()).toBe(true))
  })

  it('returns to the list with a message when the resource vanishes on a refresh', async () => {
    useScenario('resources')
    const { router } = await mountDetail()
    applyOverrides(mockState(), { deleteElsewhere: { resource: [ROOM] } })
    await testPlugins().queryClient.invalidateQueries({ queryKey: ['resources'] })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('resources'))
    expect(takeResourceListFlash()).toEqual({
      kind: 'danger',
      message: 'This resource no longer exists or is no longer available to you.',
    })
  })
})

describe('ResourceDetailPage: editing', () => {
  it("opens the classic form, saves only the changed members and says legacy's message", async () => {
    useScenario('resources')
    const { wrapper, router } = await mountDetail()
    await wrapper.get('#section-resource button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBe('resource'))
    expect(wrapper.text()).toContain('The address does not change when the description changes.')
    await wrapper.get('#resource-edit-description').setValue('Meeting Room A')
    await wrapper.get('#resource-edit-kind').setValue('thing')
    await wrapper.get('#resource-edit-bookingRule').setValue('limited')
    await wrapper.get('#resource-edit-bookingLimit').setValue('4')
    await save(wrapper)
    const patch = requests('updateResource')[0]!
    expect(patch.body).toEqual({
      description: 'Meeting Room A',
      kind: 'thing',
      bookingRule: 'limited',
      bookingLimit: 4,
    })
    expect(patch.headers['if-match']).toBeTruthy()
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain(
        'Changes to mailbox MeetingRoom1@example.org have been saved',
      ),
    )
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
    expect(field(wrapper, 'description')).toBe('Meeting Room A')
  })

  it('sends only a changed booking limit, and nothing when nothing changed', async () => {
    useScenario('resources')
    const { wrapper, router } = await mountDetail(
      `/resources/${RESOURCES_004.boardRoom}?edit=resource`,
    )
    await save(wrapper)
    expect(requests('updateResource')).toHaveLength(0)
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
    await router.push({ query: { edit: 'resource' } })
    await vi.waitFor(() => expect(wrapper.find('#resource-edit-bookingLimit').exists()).toBe(true))
    await wrapper.get('#resource-edit-bookingLimit').setValue('6')
    await wrapper.get('#resource-edit-active').setValue(false)
    await save(wrapper)
    expect(requests('updateResource')[0]!.body).toEqual({ bookingLimit: 6, active: false })
  })

  it("checks the description and booking limit against the server's limits", async () => {
    useScenario('resources-limits')
    const { wrapper } = await mountDetail(`/resources/${ROOM}?edit=resource`)
    await wrapper.get('#resource-edit-description').setValue(' ')
    await wrapper.get('#resource-edit-bookingRule').setValue('limited')
    await wrapper.get('#resource-edit-bookingLimit').setValue('20')
    await save(wrapper)
    expect(requests('updateResource')).toHaveLength(0)
    expect(wrapper.get('#resource-edit-description-error').text()).toContain(
      'This field is required.',
    )
    expect(wrapper.get('#resource-edit-bookingLimit-error').text()).toContain(
      'Enter a value from 1 to 10.',
    )
    await wrapper.get('#resource-edit-description').setValue('x'.repeat(41))
    await save(wrapper)
    expect(wrapper.get('#resource-edit-description-error').text()).toContain(
      'Enter at most 40 characters.',
    )
  })

  it("shows a refused description with legacy's message at its field", async () => {
    useScenario('resources')
    const { wrapper } = await mountDetail(`/resources/${ROOM}?edit=resource`)
    mockState().failures.updateResource = {
      status: 422,
      type: 'validation-failed',
      times: 1,
      errors: { description: [{ code: 'invalidFormat', message: 'Invalid.', params: {} }] },
    }
    await wrapper.get('#resource-edit-description').setValue('Room ✓')
    await save(wrapper)
    expect(wrapper.get('#resource-edit-description-error').text()).toContain(
      'Resource description for Room ✓ is invalid',
    )
  })

  it('lists the values changed elsewhere after a 412, keeps the input and saves again', async () => {
    useScenario('resources')
    const { wrapper } = await mountDetail(`/resources/${ROOM}?edit=resource`)
    applyOverrides(mockState(), {
      changeElsewhere: {
        resource: {
          [ROOM]: {
            description: 'Room One',
            kind: 'thing',
            bookingRule: 'alwaysFree',
            active: false,
          },
        },
      },
    })
    await wrapper.get('#resource-edit-description').setValue('Meeting Room A')
    await save(wrapper)
    const outdated = wrapper.get('[data-outdated]').text()
    expect(outdated).toContain('Description: now saved as Room One')
    expect(outdated).toContain('Kind: now saved as Thing')
    expect(outdated).toContain('Multiple bookings: now saved as')
    expect(outdated).toContain('Active: now saved as No')
    expect(wrapper.get<HTMLInputElement>('#resource-edit-description').element.value).toBe(
      'Meeting Room A',
    )
    await save(wrapper)
    expect(requests('updateResource').map((request) => request.status)).toEqual([412, 200])
  })

  it('discards the input for the values saved elsewhere after a 412', async () => {
    useScenario('resources')
    const { wrapper } = await mountDetail(`/resources/${ROOM}?edit=resource`)
    applyOverrides(mockState(), {
      changeElsewhere: { resource: { [ROOM]: { description: 'Room One' } } },
    })
    await wrapper.get('#resource-edit-description').setValue('Meeting Room A')
    await save(wrapper)
    await button(wrapper, 'Discard my changes')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-outdated]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#resource-edit-description').element.value).toBe(
      'Room One',
    )
  })

  it('returns to the list when the resource vanished before the save', async () => {
    useScenario('resources')
    const { wrapper, router } = await mountDetail(`/resources/${ROOM}?edit=resource`)
    applyOverrides(mockState(), { deleteElsewhere: { resource: [ROOM] } })
    await wrapper.get('#resource-edit-active').setValue(false)
    await save(wrapper)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('resources'))
    expect(takeResourceListFlash()?.kind).toBe('danger')
  })

  it('asks before closing the section with changes', async () => {
    useScenario('resources')
    const { wrapper, router } = await mountDetail(`/resources/${ROOM}?edit=resource`)
    await wrapper.get('#resource-edit-active').setValue(false)
    await button(wrapper, 'Cancel')!.trigger('click')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Leave without saving?'))
    settleConfirm(true)
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
    expect(requests('updateResource')).toHaveLength(0)
  })

  it('gives the open section the whole screen below md', async () => {
    useScenario('resources')
    const { wrapper } = await mountDetail(`/resources/${ROOM}?edit=resource`, false)
    expect(wrapper.find('#section-resource form').exists()).toBe(true)
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.find('[data-resource-summary]').exists()).toBe(false)
  })
})

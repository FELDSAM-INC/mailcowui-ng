// "Add resource" (US7, FR-044, FR-045, FR-047; legacy form map `#addResourceModal`): the classic
// form's fields in its order with the derived address as a live preview, no submission without a
// derivable address, the client checks against the capabilities' limits, the request as legacy
// sends it with the booking limit only for a hard limit, the new resource opened with legacy's
// `success.resource_added`, legacy's messages at their fields, a retry after a lost connection, the
// leave guard and the capabilities gate.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { takeResourceFlash } from '@/features/resources/flash'
import ResourceCreatePage from '@/features/resources/pages/ResourceCreatePage.vue'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, server, useScenario } from '../../../mocks/node'
import { mountPage } from '../aliases-common/page-support'

async function mountForm() {
  const mounted = await mountPage(ResourceCreatePage, 'resource-create', '/resources/new')
  await vi.waitFor(() =>
    expect(mounted.wrapper.find('[data-capabilities-loading]').exists()).toBe(false),
  )
  return mounted
}

type Wrapper = Awaited<ReturnType<typeof mountForm>>['wrapper']

const requests = () =>
  mockState().requests.filter((request) => request.operationId === 'createResource')

async function fill(
  wrapper: Wrapper,
  values: { description?: string; domain?: string; kind?: string; rule?: string; limit?: string },
) {
  if (values.description !== undefined) {
    await wrapper.get('#resource-description').setValue(values.description)
  }
  if (values.domain) {
    const picker = wrapper.getComponent(DomainPicker)
    picker.vm.$emit('pick', { name: values.domain, nameUnicode: values.domain })
    picker.vm.$emit('update:modelValue', values.domain)
  }
  if (values.kind) await wrapper.get('#resource-kind').setValue(values.kind)
  if (values.rule) await wrapper.get('#resource-bookingRule').setValue(values.rule)
  if (values.limit !== undefined) await wrapper.get('#resource-bookingLimit').setValue(values.limit)
  await flushPromises()
}

async function submit(wrapper: Wrapper) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  // A created resource opens its page, which replaces the form.
  await vi.waitFor(() => {
    const button = wrapper.find('button[type="submit"]')
    expect(!button.exists() || button.attributes('aria-busy') === 'false').toBe(true)
  })
  await flushPromises()
}

const errorOf = (wrapper: Wrapper, id: string) => wrapper.get(`#${id}-error`).text()

describe('ResourceCreatePage', () => {
  it("shows the classic form in its order, with legacy's defaults", async () => {
    useScenario('resources')
    const { wrapper } = await mountForm()
    expect(wrapper.get('h1').text()).toBe('Add resource')
    const labels = wrapper
      .findAll('form label')
      .map((label) => label.text().trim())
      .filter(Boolean)
    expect(labels).toEqual(['Description', 'Domain', 'Kind', 'Multiple bookings', 'Active'])
    expect(wrapper.get<HTMLSelectElement>('#resource-kind').element.value).toBe('')
    expect(wrapper.get('#resource-kind option').text()).toBe('Please select...')
    expect(wrapper.get<HTMLSelectElement>('#resource-bookingRule').element.value).toBe('unlimited')
    expect(wrapper.find('#resource-bookingLimit').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#resource-active').element.checked).toBe(true)
  })

  it('previews the derived address, and cannot be submitted without one', async () => {
    useScenario('resources')
    const { wrapper } = await mountForm()
    await fill(wrapper, { description: '!!!' })
    expect(wrapper.get('[data-address-preview]').text()).toContain('No address can be derived')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await submit(wrapper)
    expect(requests()).toHaveLength(0)
    await fill(wrapper, { description: 'Training Room 2', domain: 'example.org' })
    expect(wrapper.get('[data-address-preview]').text()).toBe(
      'Address (preview): TrainingRoom2@example.org',
    )
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('names the missing domain and kind without sending anything', async () => {
    useScenario('resources')
    const { wrapper } = await mountForm()
    await fill(wrapper, { description: 'Training Room' })
    await submit(wrapper)
    expect(requests()).toHaveLength(0)
    expect(wrapper.text()).toContain('Please correct the following')
    expect(errorOf(wrapper, 'resource-kind')).toContain('This field is required.')
  })

  it("checks the description and booking limit against the server's limits", async () => {
    useScenario('resources-limits')
    const { wrapper } = await mountForm()
    await fill(wrapper, {
      description: 'A meeting room with a very long description text',
      domain: 'example.org',
      kind: 'location',
      rule: 'limited',
      limit: '20',
    })
    await submit(wrapper)
    expect(requests()).toHaveLength(0)
    expect(errorOf(wrapper, 'resource-description')).toContain('Enter at most 40 characters.')
    expect(errorOf(wrapper, 'resource-bookingLimit')).toContain('Enter a value from 1 to 10.')
  })

  it("adds the resource with a hard limit and opens it with legacy's message", async () => {
    useScenario('resources')
    const { wrapper, router } = await mountForm()
    await fill(wrapper, {
      description: ' Training Room ',
      domain: 'example.org',
      kind: 'location',
      rule: 'limited',
      limit: '3',
    })
    await wrapper.get('#resource-active').setValue(false)
    await submit(wrapper)
    expect(requests()[0]!.body).toEqual({
      description: 'Training Room',
      domain: 'example.org',
      kind: 'location',
      bookingRule: 'limited',
      bookingLimit: 3,
      active: false,
    })
    await vi.waitFor(() =>
      expect(router.currentRoute.value.params.resourceAddress).toBe('TrainingRoom@example.org'),
    )
    expect(takeResourceFlash('TrainingRoom@example.org')).toBe(
      'Resource TrainingRoom@example.org has been added',
    )
  })

  it("shows an address in use at the description with legacy's message", async () => {
    useScenario('resources')
    const { wrapper } = await mountForm()
    await fill(wrapper, { description: 'Meeting Room 1', domain: 'example.org', kind: 'thing' })
    await submit(wrapper)
    expect(requests()[0]!.status).toBe(409)
    expect(errorOf(wrapper, 'resource-description')).toContain(
      'MeetingRoom1@example.org is already known as an alias, a mailbox',
    )
  })

  it("refuses an alias domain with legacy's message at the domain", async () => {
    useScenario('resources')
    const { wrapper } = await mountForm()
    await fill(wrapper, { description: 'Lobby', domain: 'example.net', kind: 'location' })
    await submit(wrapper)
    expect(requests()[0]!.status).toBe(422)
    expect(errorOf(wrapper, 'resource-domain')).toContain('Domain name is empty or invalid')
  })

  it('offers a retry after a lost connection and adds the resource then', async () => {
    useScenario('resources')
    const { wrapper, router } = await mountForm()
    server.use(http.post('*/api/v2/resources', () => HttpResponse.error(), { once: true }))
    await fill(wrapper, { description: 'Lobby', domain: 'example.org', kind: 'location' })
    await submit(wrapper)
    const retry = wrapper.findAll('button').find((item) => item.text() === 'Try again')!
    await retry.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('resource-detail'))
  })

  it('asks before leaving with input', async () => {
    useScenario('resources')
    const { wrapper, router } = await mountForm()
    await fill(wrapper, { description: 'Lobby' })
    const leaving = router.push('/resources')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Leave without saving?'))
    settleConfirm(true)
    await leaving
    expect(router.currentRoute.value.name).toBe('resources')
  })

  it('waits for the capabilities and says when they cannot be read', async () => {
    useScenario('capabilities-unavailable')
    const { wrapper } = await mountForm()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('The server settings this form needs could not be loaded.')
  })
})

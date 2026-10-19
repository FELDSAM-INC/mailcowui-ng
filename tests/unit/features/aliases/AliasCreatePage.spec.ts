// "Add alias" (US2, FR-018 to FR-025; legacy form map `#addAliasModal`): the classic form's fields
// in its order, the groupware option only with the groupware, the external notice for a domain
// administrator without `aliasExternalGoto`, the client checks with legacy's messages, one request
// per address with legacy's `success.alias_added` on the new alias's page, a result per address with
// the refused addresses kept in the field, a stop at a refusal of the whole form with legacy's
// message on the refused entry, a retry after a lost connection, the leave guard and the gate.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { takeAliasFlash } from '@/features/aliases/flash'
import AliasCreatePage from '@/features/aliases/pages/AliasCreatePage.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, server, useScenario } from '../../../mocks/node'
import type { ScenarioOverrides } from '../../../mocks/scenarios'
import { mountPage } from '../aliases-common/page-support'

async function mountForm(scenario = 'aliases-create', overrides: ScenarioOverrides = {}) {
  useScenario(scenario, overrides)
  const mounted = await mountPage(AliasCreatePage, 'alias-create', '/aliases/new')
  await vi.waitFor(() =>
    expect(mounted.wrapper.find('[data-capabilities-loading]').exists()).toBe(false),
  )
  return mounted
}

type Wrapper = Awaited<ReturnType<typeof mountForm>>['wrapper']

const requests = () =>
  mockState().requests.filter((request) => request.operationId === 'createAlias')

async function fill(wrapper: Wrapper, addresses: string, destinations = '') {
  await wrapper.get('#alias-addresses').setValue(addresses)
  if (destinations) await wrapper.get('#alias-goto').setValue(destinations)
}

async function submit(wrapper: Wrapper) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  // A created alias opens its page, which replaces the form.
  await vi.waitFor(() => {
    const button = wrapper.find('button[type="submit"]')
    expect(!button.exists() || button.attributes('aria-busy') === 'false').toBe(true)
  })
  await flushPromises()
}

const errorOf = (wrapper: Wrapper, id: string) => wrapper.get(`#${id}-error`).text()

const outcomes = (wrapper: Wrapper) =>
  wrapper
    .findAll('[data-create-results] li[data-outcome]')
    .map((item) => item.attributes('data-outcome'))

describe('AliasCreatePage', () => {
  it("shows the classic form in its order with legacy's defaults", async () => {
    const { wrapper } = await mountForm()
    expect(wrapper.get('h1').text()).toBe('Add alias')
    const labels = wrapper
      .findAll('form label')
      .map((label) => label.text().replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    expect(labels).toEqual([
      'Alias address/es',
      'Goto addresses',
      'Silently discard mail',
      'Learn as spam',
      'Learn as ham',
      'Alias is visible in SOGo',
      'Internal',
      'Allow to send as this alias',
      'Active',
    ])
    expect(wrapper.get<HTMLInputElement>('#alias-create-groupwareVisible').element.checked).toBe(
      true,
    )
    expect(wrapper.get<HTMLInputElement>('#alias-create-internal').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#alias-create-senderAllowed').element.checked).toBe(true)
    expect(wrapper.find('[data-external-notice]').exists()).toBe(false)
  })

  it("names the empty address and goto with legacy's messages, without sending anything", async () => {
    const { wrapper } = await mountForm()
    await submit(wrapper)
    expect(requests()).toHaveLength(0)
    expect(errorOf(wrapper, 'alias-addresses')).toContain('Alias address must not be empty')
    expect(errorOf(wrapper, 'alias-goto')).toContain(
      'An alias address must contain at least one valid goto address',
    )
  })

  it("checks the goto list against the server's length limit", async () => {
    const { wrapper } = await mountForm('aliases-create', {
      capabilities004: { destinationsMaxLength: 20 },
    })
    await fill(wrapper, 'team@example.org', 'anna@example.org, bob@example.org')
    await submit(wrapper)
    expect(requests()).toHaveLength(0)
    expect(errorOf(wrapper, 'alias-goto')).toContain('Enter at most 20 characters.')
  })

  it("adds one alias and opens it with legacy's message", async () => {
    const { wrapper, router } = await mountForm()
    await fill(wrapper, 'team@example.org', 'anna@example.org, bob@example.org')
    await wrapper.get('#alias-create-internal').setValue(true)
    await wrapper.get('#alias-create-groupwareVisible').setValue(false)
    await submit(wrapper)
    expect(requests()[0]!.body).toEqual({
      address: 'team@example.org',
      destinations: ['anna@example.org', 'bob@example.org'],
      active: true,
      senderAllowed: true,
      internal: true,
      groupwareVisible: false,
    })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('alias-detail'))
    const id = Number(router.currentRoute.value.params.aliasId)
    expect(takeAliasFlash(id)).toBe(`Alias address team@example.org (${id}) has been added`)
  })

  it('sends a special action instead of goto addresses, and no groupware option without the groupware', async () => {
    const { wrapper } = await mountForm('aliases-groupware-disabled')
    expect(wrapper.find('#alias-create-groupwareVisible').exists()).toBe(false)
    await fill(wrapper, 'trap@example.org')
    const discard = wrapper
      .findAll('form label')
      .find((label) => label.text().includes('Silently discard mail'))!
    await discard.get('input').setValue(true)
    expect(wrapper.get('#alias-goto').attributes('disabled')).toBeDefined()
    await submit(wrapper)
    expect(requests()[0]!.body).toEqual({
      address: 'trap@example.org',
      destinationType: 'discard',
      active: true,
      senderAllowed: true,
      internal: false,
    })
  })

  it('adds several addresses one after another, shows a result per address and keeps the refused ones', async () => {
    const { wrapper, router } = await mountForm()
    await fill(
      wrapper,
      'sales@example.org, team1@example.org, spam9f3k2@example.org',
      'bob@example.org',
    )
    await submit(wrapper)
    expect(requests().map((request) => request.status)).toEqual([409, 201, 409])
    expect(router.currentRoute.value.name).toBe('alias-create')
    expect(outcomes(wrapper)).toEqual(['refused', 'created', 'refused'])
    const results = wrapper.get('[data-create-results]').text()
    expect(results).toContain('sales@example.org is already known as an alias')
    expect(results).toContain('spam9f3k2@example.org is already known as a temporary alias address')
    expect(wrapper.get<HTMLTextAreaElement>('#alias-addresses').element.value).toBe(
      'sales@example.org, spam9f3k2@example.org',
    )
  })

  it("stops at a refused goto address and shows legacy's message on that entry", async () => {
    const { wrapper } = await mountForm()
    await fill(wrapper, 'rooms@example.org, desks@example.org', 'MeetingRoom1@example.org')
    await submit(wrapper)
    expect(requests()).toHaveLength(1)
    expect(outcomes(wrapper)).toEqual(['refused', 'notProcessed'])
    expect(wrapper.text()).toContain('Goto address MeetingRoom1@example.org is invalid')
  })

  it("says legacy's limit message at the address when the domain is full", async () => {
    const { wrapper } = await mountForm('aliases-create-limit')
    await fill(wrapper, 'new@example.org', 'bob@example.org')
    await submit(wrapper)
    expect(requests()[0]!.status).toBe(409)
    expect(errorOf(wrapper, 'alias-addresses')).toContain('Max. aliases exceeded')
  })

  it('warns a domain administrator without aliasExternalGoto and names the refused external entry', async () => {
    const { wrapper } = await mountForm('aliases-create-da-no-external')
    expect(wrapper.get('[data-external-notice]').text()).toContain(
      'Only addresses of domains hosted on this server can be added as goto addresses.',
    )
    await fill(wrapper, 'partners@example.org', 'anna@example.org, ext@partner.example')
    await submit(wrapper)
    expect(requests()[0]!.status).toBe(403)
    expect(wrapper.text()).toContain('External goto address ext@partner.example is not allowed')
  })

  it('marks a catch-all address in the list of entries', async () => {
    const { wrapper } = await mountForm()
    await fill(wrapper, 'team@example.com')
    expect(wrapper.get('form').text()).not.toContain('Catch-All')
    await fill(wrapper, '@example.com')
    expect(wrapper.get('form').text()).toContain('Catch-All')
  })

  it('offers a retry after a lost connection and adds the alias then', async () => {
    const { wrapper, router } = await mountForm()
    server.use(http.post('*/api/v2/aliases', () => HttpResponse.error(), { once: true }))
    await fill(wrapper, 'team@example.org', 'bob@example.org')
    await submit(wrapper)
    const retry = wrapper.findAll('button').find((item) => item.text() === 'Try again')!
    await retry.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('alias-detail'))
  })

  it('asks before leaving with input', async () => {
    const { wrapper, router } = await mountForm()
    await fill(wrapper, 'team@example.org')
    const leaving = router.push('/aliases')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Leave without saving?'))
    settleConfirm(false)
    await leaving
    expect(router.currentRoute.value.name).toBe('alias-create')
  })

  it('waits for the capabilities and says when they cannot be read', async () => {
    const { wrapper } = await mountForm('capabilities-unavailable')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('The server settings this form needs could not be loaded.')
  })
})

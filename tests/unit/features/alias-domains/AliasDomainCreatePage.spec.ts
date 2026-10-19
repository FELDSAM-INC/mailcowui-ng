// "Add domain alias" (US4, FR-036 to FR-041; legacy form map `#addAliasDomainModal`): the classic
// form's fields in its order, the DKIM fields from the server's defaults, the rate limit only with
// `ratelimit`, the client checks as input aids, one request per name with legacy's alerts on the new
// alias domain's page, a result per name with the refused names kept in the field, a stop at a
// refusal of the whole form with legacy's message at its field, and the capabilities gate.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import TargetDomainField from '@/features/alias-domains/components/TargetDomainField.vue'
import { takeCreationFlash } from '@/features/alias-domains/flash'
import AliasDomainCreatePage from '@/features/alias-domains/pages/AliasDomainCreatePage.vue'

import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, server, useScenario } from '../../../mocks/node'
import { mountPage } from '../aliases-common/page-support'

async function mountForm() {
  const { wrapper, router } = await mountPage(
    AliasDomainCreatePage,
    'alias-domain-create',
    '/alias-domains/-/new',
  )
  await vi.waitFor(() => expect(wrapper.find('[data-capabilities-loading]').exists()).toBe(false))
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountForm>>['wrapper']

const requests = () =>
  mockState().requests.filter((request) => request.operationId === 'createAliasDomain')

async function fill(wrapper: Wrapper, names: string, target: string | null) {
  await wrapper.get('#alias-domain-names').setValue(names)
  if (target) wrapper.getComponent(TargetDomainField).vm.$emit('update:modelValue', target)
  await flushPromises()
}

async function submit(wrapper: Wrapper) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  // A created alias domain opens its page, which replaces the form.
  await vi.waitFor(() => {
    const button = wrapper.find('button[type="submit"]')
    expect(!button.exists() || button.attributes('aria-busy') === 'false').toBe(true)
  })
  await flushPromises()
}

const fieldText = (wrapper: Wrapper, id: string) => wrapper.get(`#${id}-error`).text()

describe('AliasDomainCreatePage', () => {
  it("shows the classic form with the server's DKIM defaults and the rate limit for administrators", async () => {
    useScenario('alias-domains-feldhost')
    const { wrapper } = await mountForm()
    expect(wrapper.get('h1').text()).toBe('Add domain alias')
    expect(wrapper.get<HTMLInputElement>('#alias-domain-dkimSelector').element.value).toBe(
      'feldhost',
    )
    expect(wrapper.get<HTMLSelectElement>('#alias-domain-dkimKeySize').element.value).toBe('2048')
    expect(wrapper.get<HTMLInputElement>('#alias-domain-active').element.checked).toBe(true)
    expect(wrapper.find('#alias-domain-rateLimit-value').exists()).toBe(true)
    expect(wrapper.get('button[type="submit"]').text()).toBe('Add')
  })

  it('leaves out the rate limit for a domain administrator without ratelimit', async () => {
    useScenario('alias-domains-da-no-ratelimit')
    const { wrapper, router } = await mountForm()
    expect(wrapper.find('#alias-domain-rateLimit-value').exists()).toBe(false)
    await fill(wrapper, 'brand.example', 'example.org')
    await submit(wrapper)
    expect(requests()[0]!.body).not.toHaveProperty('rateLimit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('alias-domain-detail'))
  })

  it('names the required fields and an invalid rate limit without sending anything', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountForm()
    await wrapper.get('#alias-domain-rateLimit-value').setValue('ten')
    await submit(wrapper)
    expect(requests()).toHaveLength(0)
    expect(wrapper.text()).toContain('Please correct the following')
    expect(fieldText(wrapper, 'alias-domain-names')).toContain('This field is required.')
    expect(wrapper.text()).toContain('This value has an invalid format.')
  })

  it("adds one alias domain with the rate limit and DKIM key, and opens it with legacy's alerts", async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountForm()
    await fill(wrapper, 'brand.example', 'example.org')
    await wrapper.get('#alias-domain-rateLimit-value').setValue('20')
    await wrapper.get('#alias-domain-rateLimit-frame').setValue('hour')
    await wrapper.get('#alias-domain-active').setValue(false)
    await submit(wrapper)
    expect(requests()[0]!.body).toEqual({
      name: 'brand.example',
      targetDomain: 'example.org',
      active: false,
      dkimSelector: 'dkim',
      dkimKeySize: 2048,
      rateLimit: { value: 20, frame: 'hour' },
    })
    await vi.waitFor(() =>
      expect(router.currentRoute.value.params.aliasDomain).toBe('brand.example'),
    )
    // Legacy's alerts: the rate limit saved, the DKIM key added, the alias domain added.
    const alerts = takeCreationFlash('brand.example')!
    expect(alerts.map((item) => [item.kind, item.text])).toEqual([
      ['success', { legacy: 'success.rl_saved', args: ['brand.example'] }],
      ['success', { legacy: 'success.dkim_added', args: ['brand.example'] }],
      ['success', { legacy: 'success.aliasd_added', args: ['brand.example'] }],
    ])
  })

  it('sends no key size when the DKIM selector is emptied, as legacy', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountForm()
    await fill(wrapper, 'nokey.example', 'example.org')
    await wrapper.get('#alias-domain-dkimSelector').setValue('')
    await submit(wrapper)
    expect(requests()[0]!.body).toMatchObject({ dkimSelector: '' })
    expect(requests()[0]!.body).not.toHaveProperty('dkimKeySize')
  })

  it('adds several names one after another, shows a result per name and keeps the refused ones', async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountForm()
    await fill(wrapper, 'example.com\nfresh.example\nmail.example.net', 'example.org')
    await submit(wrapper)
    expect(requests().map((request) => request.status)).toEqual([409, 201, 422])
    expect(router.currentRoute.value.name).toBe('alias-domain-create')
    const outcomes = wrapper
      .findAll('[data-create-results] li[data-outcome]')
      .map((item) => item.attributes('data-outcome'))
    expect(outcomes).toEqual(['refused', 'created', 'refused'])
    const results = wrapper.get('[data-create-results]').text()
    expect(results).toContain('Alias domain example.com is invalid')
    expect(results).toContain('Domain cannot match hostname')
    expect(wrapper.get<HTMLTextAreaElement>('#alias-domain-names').element.value).toBe(
      'example.com, mail.example.net',
    )
  })

  it("stops at a refusal of the whole form and shows legacy's message at the target", async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountForm()
    await fill(wrapper, 'one.example\ntwo.example', 'relay.example')
    await submit(wrapper)
    expect(requests()).toHaveLength(1)
    expect(fieldText(wrapper, 'alias-domain-targetDomain')).toContain(
      'Target domain relay.example is a relay domain',
    )
    const outcomes = wrapper
      .findAll('[data-create-results] li[data-outcome]')
      .map((item) => item.attributes('data-outcome'))
    expect(outcomes).toEqual(['refused', 'notProcessed'])
  })

  it("shows a refused single name at its field with legacy's message", async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountForm()
    await fill(wrapper, 'example.net', 'example.com')
    await submit(wrapper)
    expect(fieldText(wrapper, 'alias-domain-names')).toContain(
      'Alias domain example.net is invalid',
    )
  })

  it('says the server is temporarily unavailable while the shared store is down', async () => {
    useScenario('alias-domains-store-down')
    const { wrapper } = await mountForm()
    await fill(wrapper, 'brand.example', 'example.org')
    await submit(wrapper)
    expect(requests()[0]!.status).toBe(503)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('offers a retry after a lost connection and adds the alias domain then', async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountForm()
    server.use(http.post('*/api/v2/alias-domains', () => HttpResponse.error(), { once: true }))
    await fill(wrapper, 'brand.example', 'example.org')
    await submit(wrapper)
    const retry = wrapper.findAll('button').find((item) => item.text() === 'Try again')!
    await retry.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('alias-domain-detail'))
  })

  it('asks before leaving with input, and stays when the user chooses to', async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountForm()
    await fill(wrapper, 'brand.example', null)
    const leaving = router.push('/alias-domains')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Leave without saving?'))
    settleConfirm(false)
    await leaving
    expect(router.currentRoute.value.name).toBe('alias-domain-create')
  })

  it('waits for the capabilities and says when they cannot be read', async () => {
    useScenario('capabilities-unavailable')
    const { wrapper } = await mountForm()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('The server settings this form needs could not be loaded.')
  })
})

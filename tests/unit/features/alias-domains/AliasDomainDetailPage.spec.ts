// The domain alias page (US4, FR-035, FR-039, FR-026 to FR-028; `templates/edit/aliasdomain.twig`):
// legacy's heading with the name, the creation's alerts, the "Edit Alias domain" section opened by
// `?edit=general` with only the changed members saved and legacy's message, the marks after a 412,
// legacy's limit message, the return to the list when the alias domain vanishes, the rate limit
// read-only, History for administrators, the canonical name, "not found" and the load error.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import TargetDomainField from '@/features/alias-domains/components/TargetDomainField.vue'
import { setCreationFlash, takeAliasDomainListFlash } from '@/features/alias-domains/flash'
import AliasDomainDetailPage from '@/features/alias-domains/pages/AliasDomainDetailPage.vue'
import { legacy } from '@/i18n'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { applyOverrides } from '../../../mocks/scenarios'
import { mountPage } from '../aliases-common/page-support'
import { testPlugins } from '../../support/mount'

async function mountDetail(path = '/alias-domains/example.net', wide = true) {
  const mounted = await mountPage(AliasDomainDetailPage, 'alias-domain-detail', path, { wide })
  await vi.waitFor(() => expect(mounted.wrapper.find('[data-page-loading]').exists()).toBe(false))
  await flushPromises()
  return mounted
}

type Wrapper = Awaited<ReturnType<typeof mountDetail>>['wrapper']

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)

async function openSection(wrapper: Wrapper) {
  await wrapper.get('#section-general button').trigger('click')
  await vi.waitFor(() => expect(wrapper.find('#section-general form').exists()).toBe(true))
}

async function save(wrapper: Wrapper) {
  await wrapper.get('#section-general form').trigger('submit')
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.text()).not.toContain('Saving…'))
  await flushPromises()
}

const rateLimit = (wrapper: Wrapper) => wrapper.find('#rate-limit [data-value="rateLimit"] dd')

describe('AliasDomainDetailPage: reading', () => {
  it("shows legacy's heading, the target, active, the rate limit and History", async () => {
    useScenario('alias-domains-admin')
    applyOverrides(mockState(), {
      changeElsewhere: {
        aliasDomain: { 'example.net': { rateLimit: { value: 10, frame: 'hour' } } },
      },
    })
    const { wrapper } = await mountDetail()
    expect(wrapper.get('h1').text()).toBe('Edit Alias domain')
    expect(wrapper.text()).toContain('example.net')
    expect(wrapper.get('[data-field="targetDomain"] a').attributes('href')).toBe(
      '/ng/domains/example.org',
    )
    expect(wrapper.get('[data-field="active"]').text()).toContain('Yes')
    // UI 006: the rate limit is its section, loaded on its own.
    await vi.waitFor(() => expect(rateLimit(wrapper).exists()).toBe(true))
    expect(rateLimit(wrapper).text()).toBe('10 msgs / hour')
    expect(wrapper.findAll('a').some((link) => link.text() === 'History')).toBe(true)
  })

  it('says the rate limit is disabled and shows no History to a domain administrator', async () => {
    useScenario('alias-domains')
    const { wrapper } = await mountDetail()
    await vi.waitFor(() => expect(rateLimit(wrapper).exists()).toBe(true))
    expect(rateLimit(wrapper).text()).toBe('Disabled')
    expect(wrapper.findAll('a').some((link) => link.text() === 'History')).toBe(false)
  })

  it("shows the creation's alerts once, and dismisses them", async () => {
    useScenario('alias-domains-admin')
    setCreationFlash('example.net', [
      { kind: 'success', text: legacy('success.aliasd_added', 'example.net'), params: [] },
    ])
    const { wrapper } = await mountDetail()
    expect(wrapper.get('[data-creation-report]').text()).toContain('Added alias domain example.net')
    await wrapper.get('[data-creation-report] button').trigger('click')
    expect(wrapper.find('[data-creation-report]').exists()).toBe(false)
  })

  it('replaces another spelling of the name with the canonical one', async () => {
    useScenario('alias-domains-admin')
    const { router } = await mountDetail('/alias-domains/EXAMPLE.NET')
    await vi.waitFor(() => expect(router.currentRoute.value.params.aliasDomain).toBe('example.net'))
  })

  it('drops an unknown section from the address', async () => {
    useScenario('alias-domains-admin')
    const { router } = await mountDetail('/alias-domains/example.net?edit=nope')
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
  })

  it('shows "not found" with the way back for an alias domain outside the scope', async () => {
    useScenario('alias-domains')
    const { wrapper } = await mountDetail('/alias-domains/legacy.example')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Page not found'))
    expect(wrapper.text()).toContain('Back to the list')
  })

  it('says the alias domain could not be loaded and retries', async () => {
    useScenario('alias-domains-store-down')
    const { wrapper } = await mountDetail()
    await vi.waitFor(() => expect(wrapper.text()).toContain('This item could not be loaded.'))
    mockState().sharedStoreDown = false
    await button(wrapper, 'Try again')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('#section-general').exists()).toBe(true))
  })

  it('returns to the list with a message when the alias domain vanishes on a refresh', async () => {
    useScenario('alias-domains-admin')
    const { router } = await mountDetail()
    applyOverrides(mockState(), { deleteElsewhere: { aliasDomain: ['example.net'] } })
    await testPlugins().queryClient.invalidateQueries({ queryKey: ['alias-domains'] })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('alias-domains'))
    expect(takeAliasDomainListFlash()).toEqual({
      kind: 'danger',
      message: 'This alias domain no longer exists or is no longer available to you.',
    })
  })
})

describe('AliasDomainDetailPage: editing', () => {
  it("opens the section through the address and saves only the changed member with legacy's message", async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountDetail()
    await openSection(wrapper)
    expect(router.currentRoute.value.query.edit).toBe('general')
    await wrapper.get('#alias-domain-edit-active').setValue(false)
    await save(wrapper)
    const patch = requests('updateAliasDomain')[0]!
    expect(patch.body).toEqual({ active: false })
    expect(patch.headers['if-match']).toBeTruthy()
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('Changes to alias domain example.net have been saved'),
    )
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
    expect(wrapper.get('[data-field="active"]').text()).toContain('No')
  })

  it('closes without a request when nothing changed', async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountDetail('/alias-domains/example.net?edit=general')
    await save(wrapper)
    expect(requests('updateAliasDomain')).toHaveLength(0)
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
  })

  it('lists the values changed elsewhere after a 412, keeps the input and saves again', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountDetail('/alias-domains/example.net?edit=general')
    applyOverrides(mockState(), {
      changeElsewhere: { aliasDomain: { 'example.net': { active: false } } },
    })
    wrapper.getComponent(TargetDomainField).vm.$emit('update:modelValue', 'other.example')
    await save(wrapper)
    expect(wrapper.get('[data-outdated]').text()).toContain('Active: now saved as No')
    await save(wrapper)
    const patches = requests('updateAliasDomain')
    expect(patches.map((request) => request.status)).toEqual([412, 200])
    expect(patches[1]!.body).toEqual({ targetDomain: 'other.example' })
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('Changes to alias domain example.net have been saved'),
    )
  })

  it('discards the input for the values saved elsewhere after a 412', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountDetail('/alias-domains/example.net?edit=general')
    applyOverrides(mockState(), {
      changeElsewhere: { aliasDomain: { 'example.net': { active: false } } },
    })
    wrapper.getComponent(TargetDomainField).vm.$emit('update:modelValue', 'other.example')
    await save(wrapper)
    await button(wrapper, 'Discard my changes')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-outdated]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#alias-domain-edit-active').element.checked).toBe(false)
    expect(wrapper.getComponent(TargetDomainField).props('modelValue')).toBe('example.org')
  })

  it("says legacy's limit message when the new target cannot take the aliases", async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountDetail('/alias-domains/example.net?edit=general')
    wrapper.getComponent(TargetDomainField).vm.$emit('update:modelValue', 'example.com')
    await save(wrapper)
    expect(requests('updateAliasDomain')[0]!.status).toBe(409)
    expect(wrapper.get('#section-general').text()).toContain('Max. aliases exceeded')
  })

  it('returns to the list when the alias domain vanished before the save', async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountDetail('/alias-domains/example.net?edit=general')
    applyOverrides(mockState(), { deleteElsewhere: { aliasDomain: ['example.net'] } })
    await wrapper.get('#alias-domain-edit-active').setValue(false)
    await save(wrapper)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('alias-domains'))
    expect(takeAliasDomainListFlash()?.kind).toBe('danger')
  })

  it('asks before closing the section with changes', async () => {
    useScenario('alias-domains-admin')
    const { wrapper, router } = await mountDetail('/alias-domains/example.net?edit=general')
    await wrapper.get('#alias-domain-edit-active').setValue(false)
    await button(wrapper, 'Cancel')!.trigger('click')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Leave without saving?'))
    settleConfirm(false)
    await flushPromises()
    expect(router.currentRoute.value.query.edit).toBe('general')
    await button(wrapper, 'Cancel')!.trigger('click')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
    expect(requests('updateAliasDomain')).toHaveLength(0)
  })

  it('gives the open section the whole screen below md', async () => {
    useScenario('alias-domains-admin')
    const { wrapper } = await mountDetail('/alias-domains/example.net?edit=general', false)
    expect(wrapper.find('#section-general form').exists()).toBe(true)
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.find('#rate-limit').exists()).toBe(false)
  })
})

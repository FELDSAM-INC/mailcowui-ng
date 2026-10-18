// The identity provider screen as a component (T025, T071 at unit level): legacy's form when nothing
// is stored, the stored values in one section, the section edit with its patch and outcomes, the
// stored test, removal and the load failure with its retry.
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setSessionContext } from '@/app/session/context'
import IdentityProviderPage from '@/features/identity-providers/provider/pages/IdentityProviderPage.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp, testPlugins } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

afterEach(() => {
  settleConfirm(false)
  setSessionContext(null)
  document.body.innerHTML = ''
})

async function mountAt(path = '/identity-providers/provider') {
  const router = createTestRouter()
  await router.push(path)
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('test'),
  })
  const wrapper = mountWithApp(IdentityProviderPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

async function fill(wrapper: VueWrapper, id: string, value: string) {
  await wrapper.get(`#${id}`).setValue(value)
}

const buttonNamed = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((button) => button.text().trim() === text)

describe('IdentityProviderPage', () => {
  it('shows the legacy form with Keycloak chosen when nothing is stored, and creates', async () => {
    useScenario('idp-none')
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.find('[data-setup]').exists()).toBe(true))
    expect((wrapper.get('#idp-type').element as HTMLSelectElement).value).toBe('keycloak')
    await wrapper.get('#idp-type').setValue('ldap')
    await fill(wrapper, 'idp-hosts', 'ldap1.example.org')
    await fill(wrapper, 'idp-baseDn', 'dc=example,dc=org')
    await fill(wrapper, 'idp-bindDn', 'cn=admin,dc=example,dc=org')
    await fill(wrapper, 'idp-bindPassword', 'secret')
    await wrapper.get('[data-setup]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-page-status]').exists()).toBe(true))
    expect(wrapper.get('[data-page-status]').text()).toMatch(/Changes to object\s+have been saved/)
    await vi.waitFor(() => expect(wrapper.find('#section-provider').exists()).toBe(true))
    expect(mockState().identityProvider.bindPassword).toBe('secret')
    expect(wrapper.text()).not.toContain('secret"')
  })

  it('marks client errors before sending', async () => {
    const state = useScenario('idp-none')
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.find('[data-setup]').exists()).toBe(true))
    await wrapper.get('[data-setup]').trigger('submit')
    await flushPromises()
    expect(wrapper.get('#idp-serverUrl').attributes('aria-invalid')).toBe('true')
    expect(state.requests.some((r) => r.operationId === 'saveIdentityProvider')).toBe(false)
  })

  it('shows the stored values and saves a section edit as a merge patch', async () => {
    const state = useScenario('idp-ldap')
    const { wrapper, router } = await mountAt()
    await vi.waitFor(() => expect(wrapper.find('#section-provider').exists()).toBe(true))
    expect(wrapper.get('[data-value="bindPassword"]').text()).toContain('Stored')
    await wrapper.get('button[aria-label="Edit LDAP"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBe('provider'))
    await vi.waitFor(() => expect(wrapper.find('#idp-syncInterval').exists()).toBe(true))
    await fill(wrapper, 'idp-syncInterval', '30')
    await wrapper.get('#section-provider form').trigger('submit')
    await vi.waitFor(() =>
      expect(state.requests.some((r) => r.operationId === 'updateIdentityProvider')).toBe(true),
    )
    const patch = state.requests.find((r) => r.operationId === 'updateIdentityProvider')!
    expect(patch.body).toEqual({ syncInterval: 30 })
    await vi.waitFor(() =>
      expect(wrapper.get('[data-value="syncInterval"]').text()).toContain('30'),
    )
  })

  it('cancels an edit and tests the stored values', async () => {
    useScenario('idp-ldap')
    const { wrapper, router } = await mountAt('/identity-providers/provider?edit=provider')
    await vi.waitFor(() => expect(wrapper.find('#idp-hosts').exists()).toBe(true))
    await buttonNamed(wrapper, 'Cancel')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
    await buttonNamed(wrapper, 'Test Connection')!.trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-test-result]').attributes('data-outcome')).toBe('success'),
    )
  })

  it('removes after the classic confirmation and shows the empty form', async () => {
    useScenario('idp-ldap')
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.find('#section-provider').exists()).toBe(true))
    await buttonNamed(wrapper, 'Remove')!.trigger('click')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Confirm deletion'))
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.find('[data-page-status]').exists()).toBe(true))
    expect(wrapper.get('[data-page-status]').text()).toMatch(/Item\s+successfully deleted/)
    expect(wrapper.find('[data-setup]').exists()).toBe(true)
  })

  it('shows the in-use refusal of a removal', async () => {
    useScenario('idp-ldap-in-use')
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.find('#section-provider').exists()).toBe(true))
    await buttonNamed(wrapper, 'Remove')!.trigger('click')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('The identity provider cannot be changed or deleted'),
    )
  })

  it('offers a retry when the configuration cannot be loaded', async () => {
    const state = useScenario('idp-ldap', {
      failures: { getIdentityProvider: { status: 500, times: 1 } },
    })
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(buttonNamed(wrapper, 'Try again')).toBeDefined())
    expect(state.failures.getIdentityProvider!.times).toBe(0)
    await buttonNamed(wrapper, 'Try again')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('#section-provider').exists()).toBe(true))
  })
})

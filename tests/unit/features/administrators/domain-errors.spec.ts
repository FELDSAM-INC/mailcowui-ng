import { beforeAll, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AccountCreatePage from '@/features/administrators/pages/AccountCreatePage.vue'
import AccountSection from '@/features/administrators/components/AccountSection.vue'
import AccountFields from '@/features/administrators/components/AccountFields.vue'
import { formFromAccount } from '@/features/administrators/account-form'
import { loadLegacy } from '@/i18n/legacy'
import { domainAdminView } from '../../../mocks/factories/domain-admin'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
vi.mock('@/shared/composables/useLeaveGuard', () => ({
  useLeaveGuard: () => ({ disarm() {}, ask: () => Promise.resolve(true) }),
}))
vi.mock('@/shared/composables/useConfirm', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))
beforeAll(() => loadLegacy('en-gb'))
it.each(['create', 'edit'] as const)(
  '%s keeps a removed domain error on that chip after another selection change',
  async (mode) => {
    useScenario('domain-admins-three')
    const account = domainAdminView(mockState().domainAdmins[0]!)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: {} }],
    })
    await router.push('/')
    const wrapper = mountWithApp(mode === 'create' ? AccountCreatePage : AccountSection, {
      props: { role: 'domainAdmin', account, editing: true, editable: true },
      global: { plugins: [router] },
      attachTo: document.body,
    })
    const fields = wrapper.getComponent(AccountFields)
    fields.vm.$emit('update:modelValue', {
      ...formFromAccount(mode === 'edit' ? account : undefined),
      username: mode === 'edit' ? account.username : 'new-owner',
      domains: ['example.net', 'example.org'],
      password: 'Secret-123!',
      password2: 'Secret-123!',
    })
    // Keep the account etag unchanged: a newly selected domain disappears before submission.
    mockState().domains = mockState().domains.filter((domain) => domain.name !== 'example.net')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-picker-item-errors]').exists()).toBe(true))
    expect(wrapper.get('[data-picker-item-errors]').text()).toBe('Domain name is empty or invalid')
    const chips = wrapper.findAll('[data-picker-chips] > li')
    expect(chips[0]!.get('button').text()).toBe('example.net')
    expect(chips[0]!.get('button').attributes('aria-describedby')).toBeTruthy()
    expect(chips[1]!.find('[data-picker-item-errors]').exists()).toBe(false)
    await chips[0]!.get('button').trigger('click')
    expect(wrapper.find('[data-picker-item-errors]').exists()).toBe(false)
    expect(wrapper.get('[data-picker-chips]').text()).toBe('example.org')
    expect(
      (wrapper.get('input[autocomplete="new-password"]').element as HTMLInputElement).value,
    ).toBe('Secret-123!')
  },
)

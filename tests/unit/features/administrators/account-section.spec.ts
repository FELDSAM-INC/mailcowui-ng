import { beforeAll, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { queryKeys } from '@/api'
import MultiSelect from '@/shared/components/MultiSelect.vue'
import AccountSection from '@/features/administrators/components/AccountSection.vue'
import PermissionsSection from '@/features/administrators/components/PermissionsSection.vue'
import { domainAdminView } from '../../../mocks/factories/domain-admin'
import { mockState, useScenario } from '../../../mocks/node'
import { loadLegacy } from '@/i18n/legacy'
import { mountWithApp, testPlugins } from '../../support/mount'
vi.mock('@/shared/composables/useConfirm', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))
vi.mock('@/shared/composables/useLeaveGuard', () => ({
  useLeaveGuard: () => ({ disarm() {}, arm() {}, ask: () => Promise.resolve(true) }),
}))
beforeAll(() => loadLegacy('en-gb'))
async function setup(permissions = false) {
  useScenario('domain-admins-three')
  const account = structuredClone(domainAdminView(mockState().domainAdmins[0]!))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: {} }],
  })
  await router.push('/')
  const wrapper = mountWithApp(permissions ? PermissionsSection : AccountSection, {
    props: {
      account,
      role: 'domainAdmin',
      editing: true,
      editable: true,
      own: false,
      lastActive: false,
    },
    global: { plugins: [router], stubs: { DomainPicker: true } },
  })
  return { wrapper, account }
}
it('saves only changed metadata and never sends an empty password', async () => {
  const { wrapper } = await setup()
  await wrapper.get('#account-edit-forcePasswordChange').trigger('click')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
  expect(
    mockState().requests.find((request) => request.operationId === 'updateDomainAdmin')?.body,
  ).toEqual({ forcePasswordChange: true })
})
it('changes a password atomically with metadata outside both caches, then clears the fields', async () => {
  const { wrapper } = await setup()
  await wrapper.get('[data-generate]').trigger('click')
  const password = (wrapper.get('input[autocomplete="new-password"]').element as HTMLInputElement)
    .value
  await wrapper.get('#account-edit-forcePasswordChange').trigger('click')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
  const request = mockState().requests.find((entry) => entry.operationId === 'updateDomainAdmin')!
  expect(request.body).toMatchObject({ password: '[redacted]', forcePasswordChange: true })
  expect(mockState().accounts.find((item) => item.username === 'reseller')?.password).toBe(password)
  const client = testPlugins().queryClient
  expect(client.getMutationCache().getAll()).toHaveLength(0)
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.state),
    ),
  ).not.toContain(password)
  expect(
    (wrapper.get('input[autocomplete="new-password"]').element as HTMLInputElement).value,
  ).toBe('')
})
it('keeps a dirty form on a stale version, shows saved changes and sends the latest tag only after Save again', async () => {
  const { wrapper } = await setup()
  await wrapper.get('#account-edit-forcePasswordChange').trigger('click')
  const stored = mockState().domainAdmins[0]!
  stored.version++
  stored.forceSecondFactorSetup = true
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
  expect(wrapper.get('#account-edit-forcePasswordChange').attributes('aria-checked')).toBe('true')
  expect(
    mockState().requests.filter((request) => request.operationId === 'updateDomainAdmin'),
  ).toHaveLength(1)
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
  expect(stored.forcePasswordChange).toBe(true)
  expect(
    testPlugins().queryClient.getQueryData(queryKeys.domainAdmins.detail(stored.username)),
  ).toMatchObject({ forcePasswordChange: true })
})
it('saves only the changed permission and retains the selection on a conflict', async () => {
  const { wrapper } = await setup(true)
  const selector = wrapper.getComponent(MultiSelect)
  selector.vm.$emit('update:modelValue', [...selector.props('modelValue'), 'loginAs'])
  mockState().domainAdmins[0]!.version++
  mockState().domainAdmins[0]!.permissions!.aliasDomains = true
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
  expect(selector.props('modelValue')).toContain('loginAs')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
  const requests = mockState().requests.filter(
    (request) => request.operationId === 'updateDomainAdmin',
  )
  expect(requests.at(-1)?.body).toEqual({ permissions: { loginAs: true } })
  expect(mockState().domainAdmins[0]!.permissions!.aliasDomains).toBe(true)
})

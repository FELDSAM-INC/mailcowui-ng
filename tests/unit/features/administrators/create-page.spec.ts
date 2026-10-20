import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeAll, expect, it, vi } from 'vitest'
import AccountCreatePage from '@/features/administrators/pages/AccountCreatePage.vue'
import { loadLegacy } from '@/i18n/legacy'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
vi.mock('@/shared/composables/useLeaveGuard', () => ({
  useLeaveGuard: () => ({ disarm() {}, ask: () => Promise.resolve(true) }),
}))
beforeAll(() => loadLegacy('en-gb'))
async function setup(role: 'admin' | 'domainAdmin' = 'domainAdmin') {
  useScenario('domain-admins-three')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: {} },
      { path: '/new', name: 'create', component: {} },
      { path: '/domain-admins/:username', name: 'domain-admin-detail', component: {} },
      { path: '/admins/:username', name: 'admin-detail', component: {} },
    ],
  })
  await router.push('/new')
  const wrapper = mountWithApp(AccountCreatePage, {
    props: { role },
    global: {
      plugins: [router],
      stubs: {
        DomainPicker: defineComponent({
          props: { label: { type: String, default: '' } },
          emits: ['update:modelValue'],
          template:
            '<div><span>{{ label }}</span><button type="button" data-pick @click="$emit(\'update:modelValue\', [\'example.org\'])">Choose domain</button></div>',
        }),
      },
    },
  })
  await vi.waitFor(() =>
    expect(
      mockState().requests.some((request) => request.operationId === 'getAccountCapabilities'),
    ).toBe(true),
  )
  return { wrapper, router }
}
it('requires username, domains and matching passwords before submitting', async () => {
  const { wrapper } = await setup()
  await wrapper.get('form').trigger('submit')
  expect(mockState().requests.some((request) => request.operationId === 'createDomainAdmin')).toBe(
    false,
  )
  expect(wrapper.text()).toContain('required')
  await wrapper.get('input[name="accountUsername"]').setValue('new-owner')
  await wrapper.get('[data-pick]').trigger('click')
  await wrapper.get('input[autocomplete="new-password"]').setValue('Secret-123!')
  await wrapper.get('form').trigger('submit')
  expect(mockState().requests.some((request) => request.operationId === 'createDomainAdmin')).toBe(
    false,
  )
  expect(wrapper.text()).toContain('Confirmation password does not match')
})
it('creates from classic fields, clears secrets and opens detail with metadata cached', async () => {
  const { wrapper, router } = await setup()
  await wrapper.get('input[name="accountUsername"]').setValue(' New.Owner ')
  await wrapper.get('[data-pick]').trigger('click')
  await wrapper.get('[data-generate]').trigger('click')
  const password = (wrapper.get('input[autocomplete="new-password"]').element as HTMLInputElement)
    .value
  expect(password.length).toBeGreaterThan(0)
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(router.currentRoute.value.params.username).toBe('new.owner'))
  expect(mockState().accounts.find((item) => item.username === 'new.owner')?.password).toBe(
    password,
  )
  expect(
    mockState().requests.find((request) => request.operationId === 'createDomainAdmin')?.body,
  ).not.toHaveProperty('permissions')
  expect(testPlugins().queryClient.getMutationCache().getAll()).toHaveLength(0)
  expect(
    JSON.stringify(
      testPlugins()
        .queryClient.getQueryCache()
        .getAll()
        .map((query) => query.state),
    ),
  ).not.toContain(password)
  expect(
    (wrapper.get('input[autocomplete="new-password"]').element as HTMLInputElement).value,
  ).toBe('')
})
it('puts an existing username error on the field and preserves the other values', async () => {
  const { wrapper } = await setup('admin')
  await wrapper.get('input[name="accountUsername"]').setValue('admin')
  await wrapper.get('[data-generate]').trigger('click')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() =>
    expect(wrapper.get('input[name="accountUsername"]').attributes('aria-invalid')).toBe('true'),
  )
  expect(
    (wrapper.get('input[autocomplete="new-password"]').element as HTMLInputElement).value,
  ).not.toBe('')
})

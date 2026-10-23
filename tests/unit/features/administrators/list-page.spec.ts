import { sortList } from '../../support/data-list'
import { beforeAll, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AccountListPage from '@/features/administrators/pages/AccountListPage.vue'
import { loadLegacy } from '@/i18n/legacy'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
vi.mock('@/shared/composables/useConfirm', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))
vi.mock('@/shared/composables/useLeaveGuard', () => ({
  useLeaveGuard: () => ({ disarm() {}, ask: () => Promise.resolve(true) }),
}))
beforeAll(() => loadLegacy('en-gb'))
async function setup(role: 'admin' | 'domainAdmin' = 'domainAdmin') {
  useScenario(role === 'admin' ? 'admins-three' : 'domain-admins-many')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: {} },
      {
        path: '/new',
        name: role === 'admin' ? 'admin-create' : 'domain-admin-create',
        component: {},
      },
      {
        path: '/detail/:username',
        name: role === 'admin' ? 'admin-detail' : 'domain-admin-detail',
        component: {},
      },
      { path: '/domain/:domain', name: 'domain-detail', component: {} },
    ],
  })
  await router.push('/')
  const wrapper = mountWithApp(AccountListPage, {
    props: { role },
    global: { plugins: [router], stubs: { DomainPicker: true } },
  })
  await vi.waitFor(() => expect(wrapper.find('[data-account-row]').exists()).toBe(true))
  await vi.waitFor(() => expect(wrapper.find('[data-selection-mode]').exists()).toBe(true))
  return { wrapper, router }
}
it('debounces search into URL state, resets selection and sorts with server parameters', async () => {
  const { wrapper, router } = await setup()
  await wrapper.get('[data-selection-mode]').trigger('click')
  await wrapper.get('[data-account-row] input[type="checkbox"]').setValue(true)
  await wrapper.get('input[type="search"]').setValue('team')
  await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBe('team'))
  expect(wrapper.find('[data-bulk-bar]').text()).toContain('0')
  await sortList(wrapper, 'domainCount')
  await vi.waitFor(() => expect(router.currentRoute.value.query.sort).toBe('domainCount'))
})
it('uses listed versions for selected bulk targets and presents per-item results', async () => {
  const { wrapper } = await setup('admin')
  await wrapper.get('[data-selection-mode]').trigger('click')
  const other = wrapper
    .findAll('[data-account-row]')
    .find((row) => row.attributes('data-account-row') === 'operator')!
  await other.get('input[type="checkbox"]').setValue(true)
  const button = wrapper
    .findAll('[data-bulk-bar] button')
    .find((item) => item.text() === 'Deactivate')!
  await button.trigger('click')
  await vi.waitFor(() =>
    expect(
      mockState().requests.some((request) => request.operationId === 'applyAdminBulkAction'),
    ).toBe(true),
  )
  const body = mockState().requests.find(
    (request) => request.operationId === 'applyAdminBulkAction',
  )?.body
  expect(body).toMatchObject({
    action: 'deactivate',
    targets: [{ id: 'operator', version: expect.stringMatching(/^"/) }],
  })
  await vi.waitFor(() => expect(wrapper.text()).toContain('Done'))
  expect(mockState().admins.find((account) => account.username === 'operator')?.active).toBe(false)
})
it('leaves the signed-in administrator out of destructive bulk requests', async () => {
  const { wrapper } = await setup('admin')
  await wrapper.get('[data-selection-mode]').trigger('click')
  await wrapper.get('[data-account-row="admin"] input[type="checkbox"]').setValue(true)
  const button = wrapper.findAll('[data-bulk-bar] button').find((item) => item.text() === 'Remove')!
  await button.trigger('click')
  expect(
    mockState().requests.some((request) => request.operationId === 'applyAdminBulkAction'),
  ).toBe(false)
  expect(wrapper.text()).toContain('Your own account was left out')
})

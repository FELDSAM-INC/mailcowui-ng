import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiProblem, queryKeys } from '@/api'
import { identityQuery } from '@/app/session/queries'
import SignInAsAction from '@/features/acting/components/SignInAsAction.vue'
import { beginActing } from '@/features/acting/actions'
import { mountWithApp, testPlugins } from '../../support/mount'
import { useScenario } from '../../../mocks/node'

vi.mock('@/features/acting/actions', () => ({ actingRequestPending: false, beginActing: vi.fn() }))
const target = { kind: 'mailboxUser', address: 'alice@example.org', domain: 'example.org' } as const

async function setup(scenario = 'acting-admin') {
  useScenario(scenario)
  const identity = await testPlugins().queryClient.fetchQuery(identityQuery())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/mailboxes', component: {} }],
  })
  await router.push('/mailboxes?q=alice&page=2')
  const wrapper = mountWithApp(SignInAsAction, { props: { target }, global: { plugins: [router] } })
  return { wrapper, identity }
}

it('hides the action when the current domain administrator has no loginAs flag', async () => {
  const { wrapper } = await setup('acting-reseller-no-login-as')
  expect(wrapper.find('button').exists()).toBe(false)
})

it('starts with the displayed target and initiating route and uses the legacy Login label', async () => {
  const { wrapper } = await setup()
  vi.mocked(beginActing).mockResolvedValueOnce()
  expect(wrapper.get('button').text()).toBe('Login alice@example.org')
  await wrapper.get('button').trigger('click')
  expect(beginActing).toHaveBeenCalledWith(target, '/mailboxes?q=alice&page=2')
})

it.each([
  [409, 'already-impersonating', 'already'],
  [403, 'permission-flag-required', 'access denied'],
  [404, null, 'could not be found'],
] as const)('keeps the action and explains a %s refusal', async (status, name, message) => {
  const { wrapper, identity } = await setup()
  vi.mocked(beginActing).mockRejectedValueOnce(
    ApiProblem.fromParts({
      kind: 'problem',
      status,
      type: name ? `/api/v2/problems/${name}` : 'about:blank',
    }),
  )
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text().toLowerCase()).toContain(message)
  expect(testPlugins().queryClient.getQueryData(queryKeys.identity())).toEqual(identity)
})

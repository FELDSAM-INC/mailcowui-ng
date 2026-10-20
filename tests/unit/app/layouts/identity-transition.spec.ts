import { expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ShellLayout from '@/app/layouts/ShellLayout.vue'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import { useSessionStore } from '@/app/session/store'
import { identityQuery } from '@/app/session/queries'
import { ApiProblem } from '@/api'
import { useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'
vi.mock('@/app/session/sign-out', () => ({
  useSignOut: () => ({ signOut: vi.fn(), retry: vi.fn() }),
}))
const stubs = {
  AppHeader: true,
  AppFooter: true,
  AppsMenu: true,
  UserMenu: true,
  NavigationDrawer: true,
  NavigationList: true,
  AnnouncementBanner: true,
  LanguageSelect: true,
  ThemeSelect: true,
  RouterView: { template: '<p data-previous-page>Old account data</p>' },
}
it.each([ShellLayout, AuthLayout])(
  'unmounts the route during a switch and offers retry after failure',
  async (layout) => {
    useScenario('admin-active')
    await testPlugins().queryClient.fetchQuery(identityQuery())
    const router = createTestRouter()
    await router.push('/')
    const wrapper = mountWithApp(layout, { global: { plugins: [router], stubs } })
    expect(wrapper.find('[data-previous-page]').exists()).toBe(true)
    useSessionStore().identityTransition = true
    await nextTick()
    expect(wrapper.find('[data-previous-page]').exists()).toBe(false)
    expect(wrapper.get('[data-identity-transition]').text()).toContain('Switching account')
    useSessionStore().identityTransitionProblem = ApiProblem.fromParts({ kind: 'network' })
    await nextTick()
    expect(wrapper.get('[data-identity-transition] button').text()).toBe('Try again')
    wrapper.unmount()
  },
)

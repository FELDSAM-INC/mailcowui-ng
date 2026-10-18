// T047: the return page (FR-045, FR-048, FR-070, FR-073): the operator's branding, an announced
// progress state, the outcome focused and announced, and the actions each outcome offers.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import SingleSignOnReturnPage from '@/features/auth/pages/SingleSignOnReturnPage.vue'
import {
  captureSingleSignOnReturn,
  SSO_RETURN_PATH,
  takeCapturedSingleSignOnReturn,
} from '@/features/auth/sso/capture'
import { lt } from '@/i18n'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

afterEach(() => {
  setSessionContext(null)
  takeCapturedSingleSignOnReturn()
  document.body.innerHTML = ''
})

function capture(search: string) {
  captureSingleSignOnReturn({
    location: { pathname: SSO_RETURN_PATH, search, hash: '' },
    history: { state: null, replaceState: vi.fn() },
  })
}

async function mountPage(search: string) {
  capture(search)
  mockState().singleSignOn.pending = {
    state: 's',
    expiresAt: Date.now() + 600_000,
    returnUrl: 'http://localhost:3000/ng/sso/return',
  }
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  queryClient.clear()
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/sso/return')
  const wrapper = mountWithApp(SingleSignOnReturnPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  return { wrapper, router }
}

describe('SingleSignOnReturnPage', () => {
  it('shows the branding and the announced progress', async () => {
    useScenario('sso-available')
    const { wrapper } = await mountPage('?code=c&state=s')
    expect(wrapper.find('[data-product-name]').exists()).toBe(true)
    expect(wrapper.get('h1').text()).toBe(lt('admin.iam_sso'))
    expect(wrapper.get('[role="status"]').text()).toContain('Completing sign-in')
  })

  it('focuses a cancelled outcome and offers both actions', async () => {
    useScenario('sso-available')
    const { wrapper } = await mountPage('?error=access_denied&state=s')
    await vi.waitFor(() => expect(wrapper.find('[data-outcome]').exists()).toBe(true))
    await flushPromises()
    const outcome = wrapper.get('[data-outcome]')
    expect(outcome.text()).toContain('cancelled')
    expect(document.activeElement).toBe(outcome.element)
    expect(wrapper.get('[data-retry]').text()).toBe('Try again')
    expect(wrapper.get('[data-back]').text()).toBe('Back to sign-in')
  })

  it('shows the classic "Login failed" for a refused completion, never the API text', async () => {
    useScenario('sso-refused')
    const { wrapper } = await mountPage('?code=c&state=s')
    await vi.waitFor(() => expect(wrapper.find('[data-outcome]').exists()).toBe(true))
    expect(wrapper.get('[data-outcome]').text()).toContain(lt('danger.login_failed'))
    expect(wrapper.text()).not.toContain('HTTP 401')
  })

  it('offers only "Back to sign-in" when single sign-on is no longer offered', async () => {
    useScenario('sso-disabled-after-start')
    const { wrapper } = await mountPage('?code=c&state=s')
    await vi.waitFor(() => expect(wrapper.find('[data-outcome]').exists()).toBe(true))
    expect(wrapper.find('[data-retry]').exists()).toBe(false)
    expect(wrapper.find('[data-back]').exists()).toBe(true)
  })
})

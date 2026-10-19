// T071: the sign-in screens (FR-001a, FR-005–FR-009) and their one-shot notices.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { queryKeys, type Role } from '@/api'
import { useSessionStore } from '@/app/session/store'
import * as authApi from '@/features/auth/api'
import SignInPage from '@/features/auth/pages/SignInPage.vue'

import { mockState, useScenario } from '../../../mocks/node'
import { publicConfig } from '../../../mocks/scenarios/public-config'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'
import { installWebAuthn } from '../../support/webauthn-stub'

async function mountPage(role: Role | null = null) {
  testPlugins().queryClient.clear()
  const router = createTestRouter()
  const path = {
    admin: '/sign-in/admin',
    domainAdmin: '/sign-in/domain-admin',
    mailboxUser: '/sign-in/mailbox-user',
  }
  await router.push(role ? path[role] : '/sign-in')
  const wrapper = mountWithApp(SignInPage, {
    props: { role },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  // Wait for the server's public configuration (the defaults show first).
  await vi.waitFor(() =>
    expect(testPlugins().queryClient.getQueryState(queryKeys.publicConfig())?.status).toBe(
      'success',
    ),
  )
  await flushPromises()
  // UI 012: the single sign-on section is a lazy component.
  await vi.dynamicImportSettled()
  await flushPromises()
  return wrapper
}

const roleLinkTexts = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
  wrapper.findAll('[data-role-links] a').map((link) => link.text())

describe('headings and role links (FR-005, FR-006)', () => {
  it('names the role in the heading of a role screen', async () => {
    useScenario('anonymous-default')
    expect((await mountPage(null)).get('h1').text()).toBe('Login')
    expect((await mountPage('admin')).get('h1').text()).toBe('Administrator Login')
    expect((await mountPage('domainAdmin')).get('h1').text()).toBe('Domain-Administrator Login')
    expect((await mountPage('mailboxUser')).get('h1').text()).toBe('User Login')
  })

  it('links the neutral screen to every role screen the operator has not hidden', async () => {
    useScenario('hidden-admin-link')
    expect(roleLinkTexts(await mountPage(null))).toEqual([
      'Log in as domain admin',
      'Log in as user',
    ])
  })

  it('links a role screen back to the neutral screen and to the other roles', async () => {
    useScenario('anonymous-default', { publicConfig: 'hidden-login-links' })
    expect(roleLinkTexts(await mountPage('mailboxUser'))).toEqual(['Sign in with any account'])
    expect(roleLinkTexts(await mountPage('admin'))).toEqual([
      'Sign in with any account',
      'Log in as user',
    ])
  })
})

describe('UI 012: single sign-on on the sign-in screens (FR-040 to FR-042, research R7)', () => {
  const ssoButton = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
    wrapper.findAll('button').find((button) => button.text() === 'Single Sign-On')
  const follows = (first: Element, second: Element) =>
    !!(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

  it('offers single sign-on below the password form, where the classic login page has it', async () => {
    useScenario('sso-available')
    for (const role of [null, 'mailboxUser'] as const) {
      const wrapper = await mountPage(role)
      const button = ssoButton(wrapper)
      expect(button, String(role)).toBeDefined()
      const form = wrapper.get('form').element
      const divider = wrapper.get('[data-other-logins]')
      expect(divider.text()).toBe('or login with')
      expect(follows(form, divider.element)).toBe(true)
      expect(follows(divider.element, button!.element)).toBe(true)
      expect(wrapper.find('a[href="/reset-password"]').exists()).toBe(true)
    }
  })

  it('never offers single sign-on on the administrator and domain-administrator screens', async () => {
    useScenario('sso-force')
    for (const role of ['admin', 'domainAdmin'] as const) {
      const wrapper = await mountPage(role)
      expect(ssoButton(wrapper)).toBeUndefined()
      expect(wrapper.find('input[autocomplete^="username"]').exists()).toBe(true)
    }
  })

  it('shows only single sign-on when it is forced and offered', async () => {
    useScenario('sso-force')
    for (const role of [null, 'mailboxUser'] as const) {
      const wrapper = await mountPage(role)
      expect(ssoButton(wrapper)).toBeDefined()
      expect(wrapper.find('input[autocomplete^="username"]').exists()).toBe(false)
      expect(wrapper.find('a[href="/reset-password"]').exists()).toBe(false)
      expect(wrapper.find('[data-other-logins]').exists()).toBe(false)
      expect(wrapper.find('[data-role-links]').exists()).toBe(true)
    }
  })

  it('ignores "force single sign-on" while single sign-on is not offered', async () => {
    for (const name of ['force-sso', 'sso-force-ldap', 'sso-force-none']) {
      useScenario(name)
      const wrapper = await mountPage(null)
      expect(ssoButton(wrapper), name).toBeUndefined()
      expect(wrapper.find('input[autocomplete^="username"]').exists()).toBe(true)
      expect(wrapper.find('a[href="/reset-password"]').exists()).toBe(true)
    }
  })

  it('shows no identity-provider hint any more (FR-042)', async () => {
    useScenario('idp-configured')
    for (const role of [null, 'domainAdmin'] as const) {
      expect((await mountPage(role)).find('[role="note"]').exists()).toBe(false)
    }
  })

  it('forgets an address left behind by an abandoned round trip', async () => {
    useScenario('sso-available')
    sessionStorage.setItem('mailcowui-ng.sso-return-to', '/domains')
    await mountPage(null)
    expect(sessionStorage.getItem('mailcowui-ng.sso-return-to')).toBeNull()
  })
})

describe('the reset link (FR-009) and app links (FR-001a)', () => {
  it('links "Forgot password?" on the neutral and mailbox-user screens only', async () => {
    useScenario('anonymous-default')
    // Verbatim, with the classic page's leading "> " (constitution IV 1.3.0).
    expect((await mountPage(null)).find('a[href="/reset-password"]').text()).toBe(
      '> Forgot Password?',
    )
    expect((await mountPage('mailboxUser')).find('a[href="/reset-password"]').exists()).toBe(true)
    expect((await mountPage('admin')).find('a[href="/reset-password"]').exists()).toBe(false)
  })

  it('lists the login-page app links under the operator label and hides an empty section', async () => {
    const config = publicConfig('default')
    useScenario('anonymous-default', {
      publicConfig: { appsLabel: 'Our services', appLinks: config.appLinks },
    })
    const wrapper = await mountPage(null)
    const section = wrapper.get('[data-app-links]')
    expect(section.get('h2').text()).toBe('Our services')
    expect(section.findAll('a').map((link) => link.text())).toEqual(['Webmail', 'Helpdesk'])

    useScenario('anonymous-default', {
      publicConfig: {
        appLinks: config.appLinks.map((link) => ({ ...link, showOnLoginPage: false })),
      },
    })
    expect((await mountPage(null)).find('[data-app-links]').exists()).toBe(false)
  })

  it('renders the help text sanitised', async () => {
    useScenario('help-html-malicious')
    const wrapper = await mountPage(null)
    const help = wrapper.get('[data-help]')
    // Behind the classic "Show/Hide help panel" disclosure (`start.help`).
    expect(help.element.tagName).toBe('DETAILS')
    expect(help.get('summary').text()).toBe('Show/Hide help panel')
    expect(help.find('script').exists()).toBe(false)
    expect(help.find('a[href="https://example.org/help"]').exists()).toBe(true)
  })
})

describe('notices from the session store', () => {
  it('shows a one-shot notice once and clears it', async () => {
    useScenario('anonymous-default')
    const store = useSessionStore()
    store.notice = 'signedOut'
    const wrapper = await mountPage(null)
    expect(wrapper.get('[data-notice]').text()).toContain('You have signed out.')
    expect(store.notice).toBeNull()
  })

  it.each([
    ['sessionEnded', 'Your session has ended. Please sign in again.'],
    ['signInTimedOut', 'The sign-in timed out. Please sign in again.'],
    ['secondFactorRejected', 'The code was not accepted. Please start the sign-in again.'],
    [
      'secondFactorUnavailable',
      'Your second factors cannot be used here. Ask an administrator to reset them.',
    ],
  ] as const)('translates the %s notice', async (notice, text) => {
    useScenario('anonymous-default')
    useSessionStore().notice = notice
    expect((await mountPage(null)).get('[data-notice]').text()).toContain(text)
  })

  it('pre-fills the kept username', async () => {
    useScenario('anonymous-default')
    useSessionStore().keptUsername = 'alice@example.org'
    const wrapper = await mountPage(null)
    expect((wrapper.get('input[autocomplete^="username"]').element as HTMLInputElement).value).toBe(
      'alice@example.org',
    )
  })
})

describe('the passkey action and the autofill request (FR-012, UI 001 fix)', () => {
  /**
   * A device with passkeys. Conditional requests stay pending until they are aborted; the passkey
   * action's prompt is dismissed. The log lists the challenge requests and every get() call with
   * the conditional requests still pending at that moment.
   */
  function deviceWithPasskeys() {
    const webauthn = installWebAuthn()
    const log: string[] = []
    let pending = 0
    const createChallenge = authApi.createPasskeyChallenge
    vi.spyOn(authApi, 'createPasskeyChallenge').mockImplementation(() => {
      log.push('challenge')
      return createChallenge()
    })
    webauthn.get.mockImplementation((options?: CredentialRequestOptions) => {
      if (options?.mediation !== 'conditional') {
        log.push(`modal get (${pending} pending)`)
        return Promise.reject(new DOMException('The user dismissed the prompt.', 'NotAllowedError'))
      }
      log.push(`conditional get (${pending} pending)`)
      pending += 1
      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => {
          pending -= 1
          log.push('conditional aborted')
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    })
    return { log, pending: () => pending }
  }

  const passkeyButton = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
    wrapper.findAll('button').find((button) => button.text() === 'Sign in with a passkey')!
  const ssoButton = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
    wrapper.findAll('button').find((button) => button.text() === 'Single Sign-On')!

  it('aborts the autofill request before the passkey action requests its challenge, resumes it after a dismissed prompt and aborts it when the screen goes', async () => {
    useScenario('anonymous-default')
    const device = deviceWithPasskeys()
    const wrapper = await mountPage(null)
    await vi.waitFor(() => expect(device.pending()).toBe(1))
    await passkeyButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(device.log).toHaveLength(7))
    expect(device.log).toEqual([
      'challenge',
      'conditional get (0 pending)',
      'conditional aborted',
      'challenge',
      'modal get (0 pending)',
      'challenge',
      'conditional get (0 pending)',
    ])
    expect(device.pending()).toBe(1)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
    expect(device.pending()).toBe(0)
  })

  it('drops an autofill challenge still on its way when the passkey action starts', async () => {
    useScenario('anonymous-default')
    mockState().delays.createPasskeyChallenge = 2_000
    const device = deviceWithPasskeys()
    const wrapper = await mountPage(null)
    await vi.waitFor(() => expect(device.log).toEqual(['challenge']))
    await passkeyButton(wrapper).trigger('click')
    mockState().delays.createPasskeyChallenge = 0
    // The autofill challenge arrives late and starts nothing; the action's prompt runs alone.
    await vi.waitFor(
      () =>
        expect(
          mockState().requests.filter((r) => r.operationId === 'createPasskeyChallenge'),
        ).toHaveLength(3),
      { timeout: 5_000 },
    )
    await flushPromises()
    expect(device.log).toEqual([
      'challenge',
      'challenge',
      'modal get (0 pending)',
      'challenge',
      'conditional get (0 pending)',
    ])
    expect(device.pending()).toBe(1)
    wrapper.unmount()
    expect(device.pending()).toBe(0)
  })

  it('resumes the autofill request when a single sign-on start is refused (UI 012)', async () => {
    useScenario('sso-not-available-on-start')
    const device = deviceWithPasskeys()
    const wrapper = await mountPage(null)
    await vi.waitFor(() => expect(device.pending()).toBe(1))
    await ssoButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(device.log).toHaveLength(5))
    expect(device.log).toEqual([
      'challenge',
      'conditional get (0 pending)',
      'conditional aborted',
      'challenge',
      'conditional get (0 pending)',
    ])
    expect(device.pending()).toBe(1)
    wrapper.unmount()
  })

  it('resumes the autofill request when the browser brings the page back from its back-forward cache after a single sign-on start (UI 012)', async () => {
    useScenario('sso-available')
    // jsdom cannot open the provider's page and reports that as an error.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const device = deviceWithPasskeys()
    const wrapper = await mountPage(null)
    await vi.waitFor(() => expect(device.pending()).toBe(1))
    await ssoButton(wrapper).trigger('click')
    await vi.waitFor(() =>
      expect(mockState().requests.map((r) => r.operationId)).toContain('startSingleSignOn'),
    )
    await flushPromises()
    expect(device.pending()).toBe(0)
    // A page shown normally is not a page brought back.
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))
    await flushPromises()
    expect(device.log).toEqual(['challenge', 'conditional get (0 pending)', 'conditional aborted'])
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    await vi.waitFor(() => expect(device.pending()).toBe(1))
    expect(device.log.slice(3)).toEqual(['challenge', 'conditional get (0 pending)'])
    wrapper.unmount()
    // Gone with the screen: a later restore starts nothing.
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    await flushPromises()
    expect(device.log).toHaveLength(6)
  })
})

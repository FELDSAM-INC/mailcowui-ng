// T071: the sign-in screens (FR-001a, FR-005–FR-009) and their one-shot notices.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { queryKeys, type Role } from '@/api'
import { useSessionStore } from '@/app/session/store'
import SignInPage from '@/features/auth/pages/SignInPage.vue'

import { useScenario } from '../../../mocks/node'
import { publicConfig } from '../../../mocks/scenarios/public-config'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

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

describe('force single sign-on (FR-007) and the identity provider (FR-008)', () => {
  it('hides the password form and the reset link on the neutral and mailbox-user screens', async () => {
    useScenario('force-sso')
    for (const role of [null, 'mailboxUser'] as const) {
      const wrapper = await mountPage(role)
      expect(wrapper.find('input[autocomplete^="username"]').exists()).toBe(false)
      expect(wrapper.find('a[href="/reset-password"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('This server uses single sign-on.')
      expect(wrapper.get('[data-sso-notice] a').attributes('href')).toBe('/')
    }
  })

  it('keeps the password form on the administrator and domain-administrator screens', async () => {
    useScenario('force-sso')
    for (const role of ['admin', 'domainAdmin'] as const) {
      const wrapper = await mountPage(role)
      expect(wrapper.find('input[autocomplete^="username"]').exists()).toBe(true)
      expect(wrapper.find('[data-sso-notice]').exists()).toBe(false)
    }
  })

  it('shows the identity-provider hint up front with the classic sign-in of the role', async () => {
    useScenario('idp-configured')
    expect((await mountPage(null)).get('[role="note"] a').attributes('href')).toBe('/')
    expect((await mountPage('domainAdmin')).get('[role="note"] a').attributes('href')).toBe(
      '/domainadmin',
    )
    useScenario('anonymous-default')
    expect((await mountPage(null)).find('[role="note"]').exists()).toBe(false)
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

// The own password (UI 005 T041, US1, FR-021 to FR-028; decisions D7, D9): legacy's field order,
// "Sign out my other sessions" ticked, the role's legacy success message with the ended sessions
// (Czech plural forms), the app passwords and the mail server's cache, the fields cleared, the
// current password's refusal and countdown, and policy refusals on the new password.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Identity } from '@/api'
import { setSessionContext } from '@/app/session/context'
import OwnPasswordForm from '@/features/account/components/password/OwnPasswordForm.vue'
import { i18n, loadFeatureMessages, loadLocale } from '@/i18n'
import { loadLegacy } from '@/i18n/legacy'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { MOCK_PASSWORD } from '../../../mocks/scenarios/accounts'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

beforeAll(async () => {
  await loadLegacy('en-gb')
})

afterEach(() => {
  setSessionContext(null)
  i18n.global.locale.value = 'en-gb'
})

function identity(role: Identity['role'], username: string): Identity {
  return {
    username,
    role,
    authentication: { method: 'password' },
    scope: { type: 'allDomains' },
    permissions: {} as Identity['permissions'],
    pendingActions: [],
  }
}

async function mountForm(who: Identity, activeAppPasswords: number | null = null) {
  const router = createTestRouter()
  await router.push('/')
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('t'),
  })
  const wrapper = mountWithApp(OwnPasswordForm, {
    props: { identity: who, activeAppPasswords },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

async function fill(wrapper: Awaited<ReturnType<typeof mountForm>>, next: string, current: string) {
  const fresh = wrapper.findAll('input[autocomplete="new-password"]')
  await fresh[0]!.setValue(next)
  await fresh[1]!.setValue(next)
  await wrapper.get('input[autocomplete="current-password"]').setValue(current)
}

describe('OwnPasswordForm', () => {
  it('announces a pending policy read and retries a failure without remounting entered fields', async () => {
    useScenario('account-domain-admin')
    mockState().delays.getOwnPasswordPolicy = 200
    mockState().failures.getOwnPasswordPolicy = { status: 500, times: 1 }
    const wrapper = await mountForm(identity('domainAdmin', 'reseller'))
    expect(
      wrapper.find('[data-password-policy-loading][role="status"][aria-busy="true"]').exists(),
    ).toBe(true)
    await fill(wrapper, 'summer2026x', MOCK_PASSWORD)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Try again'))
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Try again')!
    await retry.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-password-policy]').exists()).toBe(true))
    expect(
      (wrapper.get('input[autocomplete="new-password"]').element as HTMLInputElement).value,
    ).toBe('summer2026x')
    expect(
      (wrapper.get('input[autocomplete="current-password"]').element as HTMLInputElement).value,
    ).toBe(MOCK_PASSWORD)
    expect(wrapper.text()).not.toContain('Try again')
    wrapper.unmount()
  })

  it('orders the fields as legacy and ticks "Sign out my other sessions"', async () => {
    useScenario('account-domain-admin')
    const wrapper = await mountForm(identity('domainAdmin', 'reseller'))
    const order = wrapper
      .findAll('input')
      .map((input) => input.attributes('autocomplete') ?? input.attributes('type'))
    expect(order).toEqual([
      'username',
      'new-password',
      'new-password',
      'current-password',
      'checkbox',
    ])
    expect((wrapper.get('[data-end-other-sessions]').element as HTMLInputElement).checked).toBe(
      true,
    )
    expect(wrapper.text()).toMatch(/haveibeenpwned/i)
  })

  it('changes the password, clears the fields and reports the outcome (US1-AS1)', async () => {
    useScenario('account-domain-admin')
    const wrapper = await mountForm(identity('domainAdmin', 'reseller'))
    await fill(wrapper, 'summer2026x', MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-password-changed]').exists()).toBe(true))
    const text = wrapper.get('[data-password-changed]').text()
    expect(text).toContain('Changes to domain administrator reseller have been saved')
    expect(text).toContain('2 other sessions were signed out.')
    expect(text).toContain('Mail apps may accept the old password for up to 5 minutes.')
    for (const input of wrapper.findAll('input[type="password"]')) {
      expect((input.element as HTMLInputElement).value).toBe('')
    }
    const request = mockState().requests.find((r) => r.operationId === 'changeOwnPassword')!
    expect(request.body).toEqual({
      currentPassword: '[redacted]',
      newPassword: '[redacted]',
      endOtherSessions: true,
    })
  })

  it('sends endOtherSessions false when unticked, and leaves out the sessions line', async () => {
    useScenario('account-domain-admin')
    const wrapper = await mountForm(identity('domainAdmin', 'reseller'))
    await fill(wrapper, 'summer2026x', MOCK_PASSWORD)
    await wrapper.get('[data-end-other-sessions]').setValue(false)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-password-changed]').exists()).toBe(true))
    expect(wrapper.get('[data-password-changed]').text()).not.toContain('signed out')
    const request = mockState().requests.find((r) => r.operationId === 'changeOwnPassword')!
    expect((request.body as { endOtherSessions: boolean }).endOtherSessions).toBe(false)
  })

  it('uses the Czech plural forms in the outcome (FR-119)', async () => {
    useScenario('account-domain-admin')
    await loadLocale(i18n, 'cs-cz')
    await loadFeatureMessages('account', i18n, 'cs-cz')
    await loadLegacy('cs-cz').catch(() => undefined)
    i18n.global.locale.value = 'cs-cz'
    const wrapper = await mountForm(identity('domainAdmin', 'reseller'))
    await fill(wrapper, 'summer2026x', MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-password-changed]').exists()).toBe(true))
    const text = wrapper.get('[data-password-changed]').text()
    expect(text).toContain('Byly odhlášeny 2 další relace.')
    expect(text).toContain('až 5 minut.')
  })

  it('shows the mailbox user legacy messages and the app password hint (US1-AS4)', async () => {
    useScenario('account-mailbox')
    const wrapper = await mountForm(identity('mailboxUser', 'anna@example.org'), 3)
    expect(wrapper.get('[data-app-password-hint]').text()).toContain(
      'Your account has 3 app passwords that will not be changed.',
    )
    await fill(wrapper, 'summer2026x', MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-password-changed]').exists()).toBe(true))
    const text = wrapper.get('[data-password-changed]').text()
    expect(text).toContain('Changes to mailbox anna@example.org have been saved')
    expect(text).toContain('Your account has 3 app passwords that will not be changed.')
  })

  it('puts a wrong current password on its field, cleared (US1-AS2, FR-028)', async () => {
    useScenario('account-mailbox')
    const wrapper = await mountForm(identity('mailboxUser', 'anna@example.org'))
    await fill(wrapper, 'summer2026x', 'wrong')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Access denied or invalid form data'))
    const current = wrapper.get('input[autocomplete="current-password"]')
    expect((current.element as HTMLInputElement).value).toBe('')
    expect(current.attributes('aria-invalid')).toBe('true')
  })

  it('shows the countdown after too many wrong current passwords', async () => {
    useScenario('account-password-throttled')
    const wrapper = await mountForm(identity('mailboxUser', 'anna@example.org'))
    await fill(wrapper, 'summer2026x', MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('You can try again in'))
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('shows policy refusals on the new password and marks the rules (US1-AS3)', async () => {
    useScenario('account-domain-admin')
    const wrapper = await mountForm(identity('domainAdmin', 'reseller'))
    await fill(wrapper, 'summer', MOCK_PASSWORD)
    await flushPromises()
    expect(wrapper.findAll('[data-rule][data-met="false"]').length).toBe(2)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Password does not meet the policy'))
  })

  it('shows a pre-hashed password refusal on the field (FR-012)', async () => {
    useScenario('account-mailbox')
    const wrapper = await mountForm(identity('mailboxUser', 'anna@example.org'))
    await fill(wrapper, '{SSHA512}abcdef', MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain(
        'The password may not start with a hash scheme such as SSHA512.',
      ),
    )
  })
})

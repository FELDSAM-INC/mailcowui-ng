// T072: the password form (FR-016–FR-019, FR-081, FR-091).
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import { useSessionStore } from '@/app/session/store'
import PasswordForm from '@/features/auth/components/PasswordForm.vue'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { MOCK_PASSWORD } from '../../../mocks/scenarios/accounts'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

afterEach(() => {
  setSessionContext(null)
  vi.useRealTimers()
})

async function setup(role: 'admin' | 'domainAdmin' | 'mailboxUser' | null = null) {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/sign-in')
  const wrapper = mountWithApp(PasswordForm, {
    props: { role },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  const username = wrapper.get<HTMLInputElement>('input[autocomplete^="username"]')
  const password = wrapper.get<HTMLInputElement>('input[autocomplete="current-password"]')
  return { wrapper, router, username, password }
}

describe('fields (FR-016, FR-081)', () => {
  it('labels the fields and sets the password-manager attributes', async () => {
    const { wrapper, username, password } = await setup()
    expect(wrapper.get(`label[for="${username.attributes('id')}"]`).text()).toBe('Username')
    expect(wrapper.get(`label[for="${password.attributes('id')}"]`).text()).toBe('Password')
    expect(username.attributes()).toMatchObject({
      autocomplete: 'username',
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: 'false',
      maxlength: '255',
    })
    expect(password.attributes()).toMatchObject({ type: 'password', maxlength: '4096' })
    // The classic login page's placeholders: the email address on the role-neutral screen.
    expect(username.attributes('placeholder')).toBe('Email address')
    expect(password.attributes('placeholder')).toBe('Password')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Login')
  })

  it('asks administrators for their username', async () => {
    const { username } = await setup('admin')
    expect(username.attributes('placeholder')).toBe('Username')
  })

  it('offers passkeys in the username autofill when asked to', async () => {
    const router = createTestRouter()
    await router.push('/sign-in')
    const wrapper = mountWithApp(PasswordForm, {
      props: { role: null, webauthnAutofill: true },
      global: { plugins: [router] },
    })
    expect(wrapper.get('input[name="username"]').attributes('autocomplete')).toBe(
      'username webauthn',
    )
  })

  it('shows and hides the password with a labelled toggle', async () => {
    const { wrapper, password } = await setup()
    const toggle = wrapper.get('button[aria-label="Toggle password visibility"]')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(toggle.attributes('aria-controls')).toBe(password.attributes('id'))
    await toggle.trigger('click')
    expect(password.attributes('type')).toBe('text')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    await toggle.trigger('click')
    expect(password.attributes('type')).toBe('password')
  })
})

describe('submitting (FR-017, FR-018, FR-019)', () => {
  it('refuses empty fields before sending', async () => {
    useScenario('admin-password')
    const { wrapper } = await setup()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('This field is required.')
    expect(mockState().requests.some((r) => r.operationId === 'createSession')).toBe(false)
  })

  it('keeps the username, clears the password and focuses it after a failure', async () => {
    useScenario('admin-password')
    const { wrapper, username, password } = await setup()
    await username.setValue('admin')
    await password.setValue('wrong')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('Login failed'))
    expect(username.element.value).toBe('admin')
    expect(password.element.value).toBe('')
    expect(document.activeElement).toBe(password.element)
  })

  it('shows the busy state and ignores a second submit while waiting', async () => {
    useScenario('slow-sign-in')
    const { wrapper, username, password } = await setup()
    await username.setValue('admin')
    await password.setValue('wrong')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const button = wrapper.get('button[type="submit"]')
    expect(button.text()).toBe('Please wait...')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('submitting')).toHaveLength(1)
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true), {
      timeout: 4000,
    })
    expect(mockState().requests.filter((r) => r.operationId === 'createSession')).toHaveLength(1)
  })

  it('sends the role of a role screen and clears the kept username after success', async () => {
    useScenario('domain-admin-password')
    const store = useSessionStore()
    store.keptUsername = 'reseller'
    const { wrapper, router, password } = await setup('domainAdmin')
    await password.setValue(MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/domains'))
    const attempt = mockState().requests.find((r) => r.operationId === 'createSession')
    expect(attempt?.body).toMatchObject({ username: 'reseller', role: 'domainAdmin' })
    expect(store.keptUsername).toBeNull()
  })

  it('disables sign-in while throttled', async () => {
    useScenario('throttled')
    const { wrapper, username, password } = await setup()
    await username.setValue('admin')
    await password.setValue('x')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('You can try again in 1:30'))
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})

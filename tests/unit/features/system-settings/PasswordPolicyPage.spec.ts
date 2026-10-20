import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { queryKeys, type PasswordPolicy } from '@/api'
import { loadFeatureMessages } from '@/i18n'
import PasswordPolicyPage from '@/features/system-settings/pages/passwords/PasswordPolicyPage.vue'

import { settingsCapabilities } from '../../../mocks/factories/settings'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

async function setup(demoMode = false) {
  useScenario('settings-admin-defaults')
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: PasswordPolicyPage,
        props: { capabilities: settingsCapabilities({ demoMode }) },
      },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mountWithApp(RouterView, { global: { plugins: [router] } })
  await vi.waitFor(() =>
    expect(wrapper.find('[data-policy-rules]').text()).toContain('Minimum password length is 6'),
  )
  return wrapper
}

describe('Password Settings policy editor', () => {
  it('preserves the legacy checkbox order and previews the changed rules before saving to the shared cache', async () => {
    const wrapper = await setup()
    await wrapper.get('#section-policy button').trigger('click')
    expect(
      wrapper
        .findAll('#section-policy input[type="checkbox"]')
        .map((input) => input.attributes('name')),
    ).toEqual(['requireLetters', 'requireSpecialCharacters', 'requireMixedCase', 'requireDigits'])
    await wrapper.get('#policy-minLength').setValue('10')
    await wrapper.get('#policy-requireMixedCase').setValue(true)
    await wrapper.get('#policy-requireDigits').setValue(true)
    expect(wrapper.get('[data-policy-rules]').text()).toContain('Minimum password length is 10')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(false))
    const policy = testPlugins().queryClient.getQueryData<PasswordPolicy>(
      queryKeys.passwordPolicy(),
    )
    expect(policy).toMatchObject({ minLength: 10, requireMixedCase: true, requireDigits: true })
    expect(wrapper.text()).toContain('Password policy was saved successfully')
  })

  it.each(['2', '65', '3.5', ''])(
    'refuses invalid length %s before sending a policy write',
    async (value) => {
      const wrapper = await setup()
      await wrapper.get('#section-policy button').trigger('click')
      await wrapper.get('#policy-minLength').setValue(value)
      await wrapper.get('form').trigger('submit')
      expect(mockState().passwordPolicy.minLength).toBe(6)
      expect(wrapper.get('#policy-minLength').attributes('aria-invalid')).toBe('true')
      expect(wrapper.find('form').exists()).toBe(true)
    },
  )

  it('keeps the draft across a stale version and merges only changed rules on explicit retry', async () => {
    const wrapper = await setup()
    await wrapper.get('#section-policy button').trigger('click')
    await wrapper.get('#policy-minLength').setValue('12')
    mockState().passwordPolicy.requireDigits = true
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Changed elsewhere'))
    expect((wrapper.get('#policy-minLength').element as HTMLInputElement).value).toBe('12')
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Save again')!
    expect(retry.attributes('type')).toBe('submit')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(false))
    expect(mockState().passwordPolicy).toMatchObject({ minLength: 12, requireDigits: true })
  })

  it('keeps demo-mode rules readable and exposes no edit action', async () => {
    const wrapper = await setup(true)
    expect(wrapper.find('[data-demo-mode]').text()).toBe('Demo Mode is enabled')
    expect(wrapper.find('#section-policy button').exists()).toBe(false)
    expect(wrapper.find('#section-policy input').exists()).toBe(false)
  })
})

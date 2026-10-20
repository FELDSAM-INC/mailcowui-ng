import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { api } from '@/api'
import { loadFeatureMessages } from '@/i18n'
import RspamdWebInterfacePage from '@/features/system-settings/pages/spam/RspamdWebInterfacePage.vue'
import * as announcer from '@/shared/composables/useAnnouncer'

import { settingsCapabilities } from '../../../mocks/factories/settings'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

async function setup(scenario = 'settings-admin-defaults', options = {}) {
  useScenario(scenario)
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: RspamdWebInterfacePage,
        props: { capabilities: settingsCapabilities(options) },
      },
      { path: '/system', name: 'system-settings', component: { template: '<div />' } },
      { path: '/audit', name: 'audit-log', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  return mountWithApp(RouterView, { global: { plugins: [router] } })
}

async function fill(
  wrapper: Awaited<ReturnType<typeof setup>>,
  password: string,
  repeat = password,
) {
  await wrapper.get('#rspamd-new-password').setValue(password)
  await wrapper.get('#rspamd-new-password2').setValue(repeat)
}

const requests = () => mockState().requests.filter((r) => r.operationId === 'setRspamdUiPassword')

describe('Rspamd UI password page (UI013 T148/T152)', () => {
  it('starts with the exact legacy fields, supports show/hide and uses the capability link', async () => {
    const wrapper = await setup('settings-admin-defaults', {
      rspamdWebInterfaceUrl: '/custom-rspamd/',
    })
    expect(wrapper.findAll('label').map((label) => label.text())).toEqual([
      'Password',
      'Confirmation password (repeat)',
    ])
    expect(wrapper.get('a[data-rspamd-link]').attributes('href')).toBe('/custom-rspamd/')
    for (const input of wrapper.findAll('input')) {
      expect((input.element as HTMLInputElement).value).toBe('')
      expect(input.attributes('autocomplete')).toBe('new-password')
      expect(input.attributes('type')).toBe('password')
    }
    await wrapper.get('button[aria-controls]').trigger('click')
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(2)
    await wrapper.get('button[aria-controls]').trigger('click')
    expect(wrapper.findAll('input[type="password"]')).toHaveLength(2)
    expect(requests()).toHaveLength(0)
  })

  it('drops unsafe reported addresses', async () => {
    const wrapper = await setup('settings-admin-defaults', {
      rspamdWebInterfaceUrl: 'javascript:alert(1)',
    })
    expect(wrapper.find('[data-rspamd-link]').exists()).toBe(false)
  })

  it.each([
    ['', '', 'Password must not be empty'],
    ['short', 'short', 'Rspamd UI password should be at least 6 chars long'],
    ['abcdef', 'different', 'Confirmation password does not match'],
    ['a'.repeat(257), 'a'.repeat(257), 'Enter at most 256 characters.'],
    ['abc\tdef', 'abc\tdef', 'This value has an invalid format.'],
  ])('checks input before sending (%s)', async (password, repeat, message) => {
    const wrapper = await setup()
    await fill(wrapper, password, repeat)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain(message)
    expect(requests()).toHaveLength(0)
  })

  it('passes quotes and spaces unchanged, clears both fields and keeps secrets out of caches', async () => {
    const wrapper = await setup()
    const put = vi.spyOn(api, 'PUT')
    const secret = '  "Rspamd secret"  '
    await fill(wrapper, secret)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-rspamd-success]').exists()).toBe(true))
    expect(put).toHaveBeenCalledWith('/settings/rspamd-ui-password', { body: { password: secret } })
    expect(wrapper.get('[data-rspamd-success]').text()).toContain(
      'Rspamd UI password successfully set',
    )
    expect(wrapper.get('[data-rspamd-success]').text()).toContain('Rspamd restarted')
    expect((wrapper.get('#rspamd-new-password').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('#rspamd-new-password2').element as HTMLInputElement).value).toBe('')
    expect(JSON.stringify(testPlugins().queryClient.getQueryCache().getAll())).not.toContain(secret)
    expect(testPlugins().queryClient.getMutationCache().getAll()).toHaveLength(0)
    expect(JSON.stringify(requests())).not.toContain(secret)
    expect(wrapper.text()).not.toContain(secret)
  })

  it.each([
    ['rspamd-ui-service-fails', 'The change could not be confirmed'],
    ['rspamd-ui-outcome-unknown', 'It is unknown whether the password was set'],
  ])(
    'clears failed input and retries with a newly entered secret (%s)',
    async (scenario, message) => {
      const wrapper = await setup(scenario)
      await fill(wrapper, 'Attempt-password')
      await wrapper.get('form').trigger('submit')
      await vi.waitFor(() =>
        expect(wrapper.find('[data-rspamd-outcome]').text()).toContain(message),
      )
      expect((wrapper.get('#rspamd-new-password').element as HTMLInputElement).value).toBe('')
      expect((wrapper.get('#rspamd-new-password2').element as HTMLInputElement).value).toBe('')
      expect(wrapper.text()).not.toContain('Attempt-password')
      await wrapper.get('[data-rspamd-outcome] button').trigger('click')
      expect(requests()).toHaveLength(1)
      delete mockState().failures.setRspamdUiPassword
      await fill(wrapper, 'Second-password')
      await wrapper.get('form').trigger('submit')
      await vi.waitFor(() => expect(wrapper.find('[data-rspamd-success]').exists()).toBe(true))
      expect(requests()).toHaveLength(2)
    },
  )

  it('maps server field violations and clears both values after the refusal', async () => {
    const wrapper = await setup()
    mockState().failures.setRspamdUiPassword = {
      status: 422,
      type: 'validation-failed',
      errors: { password: [{ code: 'tooShort', message: 'too short', params: { min: 6 } }] },
    }
    await fill(wrapper, 'Valid-password')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('Rspamd UI password should be at least 6 chars long'),
    )
    expect(wrapper.get('#rspamd-new-password').attributes('aria-invalid')).toBe('true')
    expect((wrapper.get('#rspamd-new-password').element as HTMLInputElement).value).toBe('')
  })

  it('ignores duplicate submits and late results after unmount', async () => {
    const wrapper = await setup()
    const announce = vi.spyOn(announcer, 'announce')
    mockState().delays.setRspamdUiPassword = 100
    await fill(wrapper, 'Pending-password')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
    await vi.waitFor(() => expect(requests()).toHaveLength(1))
    await flushPromises()
    expect(announce).not.toHaveBeenCalled()
    expect(testPlugins().queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('follows the contract allowing this non-branding action in demo mode', async () => {
    const wrapper = await setup('settings-demo-mode', { demoMode: true })
    await fill(wrapper, 'Demo-password')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-rspamd-success]').exists()).toBe(true))
  })
})

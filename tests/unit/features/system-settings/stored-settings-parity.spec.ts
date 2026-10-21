import type { Component } from 'vue'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import PasswordPolicyPage from '@/features/system-settings/pages/passwords/PasswordPolicyPage.vue'
import SignInPageSettingsPage from '@/features/system-settings/pages/branding/SignInPageSettingsPage.vue'
import UiTextsPage from '@/features/system-settings/pages/branding/UiTextsPage.vue'
import { loadFeatureMessages, lt } from '@/i18n'
import { useScenario } from '../../../mocks/node'
import { settingsCapabilities } from '../../../mocks/factories/settings'
import { brandingState, publishUiTexts } from '../../../mocks/scenarios/settings-branding'
import { loginLinksState } from '../../../mocks/scenarios/settings-login-links'
import { mountWithApp } from '../../support/mount'

const mounted: VueWrapper[] = []
beforeEach(async () => {
  await loadFeatureMessages('system-settings')
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})
async function page(component: Component) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component, props: { capabilities: settingsCapabilities() } },
      { path: '/audit', name: 'audit-log', component: { template: '<p>History</p>' } },
      { path: '/identity-providers', component: { template: '<p>Identity provider</p>' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mountWithApp(RouterView, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  mounted.push(wrapper)
  return wrapper
}

describe('T174 stored settings values', () => {
  it('shows each custom policy flag and writes changed false values without resetting other rules', async () => {
    const state = useScenario('settings-admin-defaults', {
      passwordPolicy: {
        minLength: 13,
        requireLetters: false,
        requireSpecialCharacters: true,
        requireMixedCase: false,
        requireDigits: true,
      },
    })
    const wrapper = await page(PasswordPolicyPage)
    await vi.waitFor(() => expect(wrapper.find('[data-policy-length]').text()).toBe('13'))
    expect(
      wrapper
        .findAll('#section-policy dl > div')
        .map((row) => [row.get('dt').text(), row.get('dd').text()]),
    ).toEqual([
      [lt('admin.password_length'), '13'],
      [lt('admin.password_policy_chars'), 'No'],
      [lt('admin.password_policy_special_chars'), 'Yes'],
      [lt('admin.password_policy_lowerupper'), 'No'],
      [lt('admin.password_policy_numbers'), 'Yes'],
    ])
    await wrapper.get('#section-policy button').trigger('click')
    expect((wrapper.get('#policy-requireLetters').element as HTMLInputElement).checked).toBe(false)
    expect(
      (wrapper.get('#policy-requireSpecialCharacters').element as HTMLInputElement).checked,
    ).toBe(true)
    await wrapper.get('#policy-requireLetters').setValue(true)
    await wrapper.get('#policy-requireSpecialCharacters').setValue(false)
    await wrapper.get('#section-policy form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('#section-policy form').exists()).toBe(false))
    expect(
      state.requests
        .filter((request) => request.operationId === 'updatePasswordPolicy')
        .map((request) => request.body),
    ).toEqual([{ requireLetters: true, requireSpecialCharacters: false }])
    expect(state.passwordPolicy).toEqual({
      minLength: 13,
      requireLetters: true,
      requireSpecialCharacters: false,
      requireMixedCase: false,
      requireDigits: true,
    })
  })

  it('shows independently stored login flags and unhides mailbox login without changing the other roles', async () => {
    const state = useScenario('settings-admin-defaults', {
      publicConfig: {
        loginPage: {
          hideMailboxUserLogin: true,
          hideDomainAdminLogin: false,
          hideAdminLogin: true,
          forceSingleSignOn: false,
        },
      },
    })
    const wrapper = await page(SignInPageSettingsPage)
    await vi.waitFor(() => expect(wrapper.find('#section-sign-in-links dl').exists()).toBe(true))
    expect(wrapper.findAll('#section-sign-in-links dd').map((entry) => entry.text())).toEqual([
      'Yes',
      'No',
      'Yes',
    ])
    expect(wrapper.get('#section-single-sign-on dd').text()).toBe('No')
    await wrapper.get('#section-sign-in-links button').trigger('click')
    expect(
      (wrapper.get('#login-page-hideMailboxUserLogin').element as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      (wrapper.get('#login-page-hideDomainAdminLogin').element as HTMLInputElement).checked,
    ).toBe(false)
    expect((wrapper.get('#login-page-hideAdminLogin').element as HTMLInputElement).checked).toBe(
      true,
    )
    await wrapper.get('#login-page-hideMailboxUserLogin').setValue(false)
    await wrapper.get('#section-sign-in-links form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('#section-sign-in-links form').exists()).toBe(false))
    expect(
      state.requests
        .filter((request) => request.operationId === 'updateLoginPageSettings')
        .map((request) => request.body),
    ).toEqual([{ hideMailboxUserLogin: false }])
    expect(loginLinksState(state).login).toMatchObject({
      hideMailboxUserLogin: false,
      hideDomainAdminLogin: false,
      hideAdminLogin: true,
      forceSingleSignOn: false,
    })
    expect(state.publicConfig.loginPage).toEqual({
      hideMailboxUserLogin: false,
      hideDomainAdminLogin: false,
      hideAdminLogin: true,
      forceSingleSignOn: false,
    })
  })

  it('reopens an inactive announcement with its stored type and literal text, then activates without rewriting them', async () => {
    const state = useScenario('ui-texts-custom')
    brandingState(state).texts.announcement = {
      type: 'danger',
      text: '<b>Planned outage</b>',
      active: false,
    }
    publishUiTexts(state)
    const wrapper = await page(UiTextsPage)
    await vi.waitFor(() => expect(wrapper.find('#section-announcement').exists()).toBe(true))
    expect(wrapper.find('[data-announcement]').exists()).toBe(false)
    await wrapper.get('#section-announcement button').trigger('click')
    expect((wrapper.get('#ui-text-announcement-type').element as HTMLSelectElement).value).toBe(
      'danger',
    )
    expect((wrapper.get('#ui-text-announcement-text').element as HTMLTextAreaElement).value).toBe(
      '<b>Planned outage</b>',
    )
    expect((wrapper.get('#ui-text-announcement-active').element as HTMLInputElement).checked).toBe(
      false,
    )
    await wrapper.get('#ui-text-announcement-active').setValue(true)
    await wrapper.get('#section-announcement form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('#section-announcement form').exists()).toBe(false))
    await flushPromises()
    expect(
      state.requests
        .filter((request) => request.operationId === 'updateUiTexts')
        .map((request) => request.body),
    ).toEqual([{ announcement: { active: true } }])
    expect(wrapper.get('#section-announcement [data-announcement]').text()).toContain(
      '<b>Planned outage</b>',
    )
    expect(wrapper.find('#section-announcement [data-announcement] b').exists()).toBe(false)
    expect(state.publicConfig.announcement).toEqual({
      type: 'danger',
      text: '<b>Planned outage</b>',
      active: true,
    })
  })
})

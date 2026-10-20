import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { loadFeatureMessages } from '@/i18n'
import PasswordResetEmailSection from '@/features/system-settings/components/passwords/PasswordResetEmailSection.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { settingsCapabilities } from '../../../mocks/factories/settings'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

async function setup(scenario = 'password-reset-available') {
  useScenario(scenario)
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: PasswordResetEmailSection,
        props: { capabilities: settingsCapabilities() },
      },
    ],
  })
  await router.push('/')
  const wrapper = mountWithApp(RouterView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.find('[data-reset-availability]').exists()).toBe(true))
  await wrapper.get('#section-password-reset button').trigger('click')
  return wrapper
}

describe('Password Recovery Settings section', () => {
  it('confirms before clearing the active subject, preserves a declined draft and saves after approval', async () => {
    const wrapper = await setup()
    await wrapper.get('#reset-subject').setValue('')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(confirmState.value?.description).toContain('every user'))
    expect(mockState().settings.passwordReset.subject).toBe('Reset your password')
    settleConfirm(false)
    await vi.waitFor(() =>
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined(),
    )
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(false))
    expect(mockState().settings.passwordReset.subject).toBe('')
    expect(wrapper.get('[data-reset-availability]').text()).toContain('unavailable')
  })
  it('restores defaults using two empty strings while keeping the sender and subject', async () => {
    const wrapper = await setup('password-reset-custom')
    await wrapper.get('[data-restore-templates]').trigger('click')
    expect((wrapper.get('#reset-textTemplate').element as HTMLTextAreaElement).value).toBe('')
    expect((wrapper.get('#reset-htmlTemplate').element as HTMLTextAreaElement).value).toBe('')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(false))
    expect(mockState().settings.passwordReset).toMatchObject({
      sender: 'no-reply@example.org',
      subject: 'Reset your password',
      textTemplate: '',
      htmlTemplate: '',
    })
    expect(wrapper.find('[data-default-template]').exists()).toBe(true)
  })
  it('blocks an invalid sender and permits a warned template without a reset link', async () => {
    const wrapper = await setup()
    await wrapper.get('#reset-sender').setValue('no-reply@')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('#reset-sender').attributes('aria-invalid')).toBe('true')
    await wrapper.get('#reset-sender').setValue('help@example.org')
    await wrapper.get('#reset-textTemplate').setValue('Contact support')
    expect(wrapper.get('[data-template-warning]').text()).toContain('reset link')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(false))
    expect(mockState().settings.passwordReset.textTemplate).toBe('Contact support')
  })
  it('does not save after unmount while a confirmation is open', async () => {
    const wrapper = await setup()
    await wrapper.get('#reset-subject').setValue('')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    wrapper.unmount()
    settleConfirm(true)
    await Promise.resolve()
    expect(mockState().settings.passwordReset.subject).toBe('Reset your password')
  })
})

beforeEach(() => {
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

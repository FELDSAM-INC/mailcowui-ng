import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { loadFeatureMessages } from '@/i18n'
import QuotaCopiesSection from '@/features/system-settings/components/notifications/QuotaCopiesSection.vue'
import { mockState, useScenario } from '../../../../../mocks/node'
import { mountWithApp } from '../../../../support/mount'

async function setup(scenario = 'quota-copies-example-org') {
  useScenario(scenario)
  if (scenario === 'quota-defaults')
    mockState().settings.capabilities.limits.quotaNotificationRecipientsMax = 1
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/audit', name: 'audit-log', component: { template: '<div />' } },
      { path: '/', component: QuotaCopiesSection, props: { domain: 'example.org' } },
    ],
  })
  await router.push('/')
  const wrapper = mountWithApp(RouterView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.find('[data-quota-copies-view]').exists()).toBe(true))
  return wrapper
}
describe('quota notification copies', () => {
  it('allows a domain administrator to replace copies without requesting admin capabilities or showing History', async () => {
    const wrapper = await setup()
    expect(wrapper.find('a').exists()).toBe(false)
    await wrapper.get('#section-quota-copies button').trigger('click')
    await wrapper
      .get('#quota-copies-recipients')
      .setValue('IT@example.org; it@example.org boss@example.net')
    await wrapper.get('#quota-copies-active').setValue(true)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(false))
    expect(mockState().settings.quotaCopies['example.org']).toMatchObject({
      recipients: ['IT@example.org', 'boss@example.net'],
      active: true,
    })
  })
  it('marks invalid entries, explains empty active lists and displays the saved inactive state', async () => {
    const wrapper = await setup()
    await wrapper.get('#section-quota-copies button').trigger('click')
    await wrapper.get('#quota-copies-recipients').setValue('bad')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('#quota-copies-recipients').attributes('aria-invalid')).toBe('true')
    await wrapper.get('#quota-copies-recipients').setValue('')
    await wrapper.get('#quota-copies-active').setValue(true)
    expect(wrapper.text()).toContain('inactive')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(false))
    expect(mockState().settings.quotaCopies['example.org']?.active).toBe(false)
  })
  it('shows History for an administrator and enforces a reduced advertised limit', async () => {
    const wrapper = await setup('quota-defaults')
    expect(wrapper.find('a').exists()).toBe(true)
    mockState().settings.capabilities.limits.quotaNotificationRecipientsMax = 1
    await wrapper.get('#section-quota-copies button').trigger('click')
    await wrapper.get('#quota-copies-recipients').setValue('one@example.org two@example.org')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.get('#quota-copies-recipients').attributes('aria-invalid')).toBe('true'),
    )
  })
  it('retains the draft and prevents further saves when the domain disappears', async () => {
    const wrapper = await setup()
    await wrapper.get('#section-quota-copies button').trigger('click')
    await wrapper.get('#quota-copies-recipients').setValue('it@example.org')
    mockState().domains = []
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('no longer available'))
    expect((wrapper.get('#quota-copies-recipients').element as HTMLTextAreaElement).value).toBe(
      'it@example.org',
    )
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  })
})

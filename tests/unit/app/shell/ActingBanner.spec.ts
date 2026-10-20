import { flushPromises } from '@vue/test-utils'
import { expect, it } from 'vitest'
import type { Impersonation } from '@/api'
import ActingBanner from '@/app/shell/ActingBanner.vue'
import { mountWithApp } from '../../support/mount'

const acting: Impersonation = {
  id: '01K00000000000000000000000',
  startedAt: '2026-10-20T10:00:00Z',
  impersonator: { username: 'admin', role: 'admin', authMethod: 'password' },
  target: { username: 'long.mailbox.name@example.org', role: 'mailboxUser' },
}
it('names a persistent region, exposes the full account name and a one-tap return', async () => {
  const wrapper = mountWithApp(ActingBanner, { props: { impersonation: acting } })
  expect(wrapper.get('section').attributes('aria-labelledby')).toBeTruthy()
  expect(wrapper.text()).toContain('Acting as')
  expect(wrapper.text()).toContain('mailbox user')
  const toggle = wrapper.get('[data-acting-name]')
  expect(toggle.attributes('aria-label')).toContain(acting.target.username)
  expect(toggle.attributes('aria-expanded')).toBe('false')
  expect(wrapper.get('[data-acting-domain]').text()).toBe('@example.org')
  await toggle.trigger('click')
  expect(toggle.attributes('aria-expanded')).toBe('true')
  expect(wrapper.get('[data-acting-return]').text()).toBe('Return to admin')
  expect(wrapper.get('[data-acting-return]').classes()).toContain('min-h-11')
  expect(wrapper.find('[aria-live], [role="status"]').exists()).toBe(false)
  await wrapper.setProps({
    impersonation: { ...acting, target: { username: 'reseller', role: 'domainAdmin' } },
  })
  await flushPromises()
  expect(wrapper.text()).toContain('domain administrator')
  expect(wrapper.find('[data-acting-domain]').exists()).toBe(false)
})

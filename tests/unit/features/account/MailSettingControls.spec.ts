import { beforeAll, describe, expect, it } from 'vitest'
import TaggedMailSetting from '@/features/account/components/mail-settings/TaggedMailSetting.vue'
import TlsPolicySetting from '@/features/account/components/mail-settings/TlsPolicySetting.vue'
import { loadLegacy } from '@/i18n/legacy'
import { mountWithApp } from '../../support/mount'

beforeAll(() => loadLegacy('en-gb'))
describe('mail setting controls', () => {
  it('keeps legacy tagging order/help and exposes the stored single choice', async () => {
    const wrapper = mountWithApp(TaggedMailSetting, { props: { value: 'none', pending: false } })
    expect(wrapper.findAll('button').map((button) => button.attributes('data-value'))).toEqual([
      'subfolder',
      'subject',
      'none',
    ])
    expect(wrapper.get('[data-value="none"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('me+Facebook@example.org')
    await wrapper.get('[data-value="subject"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([['subject']])
    await wrapper.setProps({ pending: true })
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
  })
  it('shows both TLS values and the warning before any interaction', async () => {
    const wrapper = mountWithApp(TlsPolicySetting, {
      props: { inbound: false, outbound: true, pending: false, showWarning: true },
    })
    expect(wrapper.get('[data-tls="inbound"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[data-tls="outbound"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-tls-warning]').exists()).toBe(true)
    await wrapper.get('[data-tls="inbound"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([[{ tlsEnforceInbound: true }]])
  })
})

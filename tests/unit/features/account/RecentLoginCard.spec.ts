import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import RecentLoginCard from '@/features/account/components/recent-logins/RecentLoginCard.vue'
import { i18n } from '@/i18n'
import { recentLogin } from '../../../mocks/factories/recent-login'
import { mountWithApp } from '../../support/mount'

describe('RecentLoginCard', () => {
  it('uses the locale for countries, stored service code and a semantic time', async () => {
    const wrapper = mountWithApp(RecentLoginCard, {
      props: {
        entry: recentLogin({ service: 'CUSTOM', lastSeenAt: '2026-10-20T08:00:00Z' }),
      },
    })
    expect(wrapper.text()).toContain('Germany')
    expect(wrapper.text()).toContain('CUSTOM')
    expect(wrapper.get('time').attributes('datetime')).toBe('2026-10-20T08:00:00.000Z')
    i18n.global.locale.value = 'cs-cz'
    await nextTick()
    expect(wrapper.text()).toContain(new Intl.DisplayNames('cs-CZ', { type: 'region' }).of('DE'))
  })
  it('labels internal addresses and deleted app passwords without linking them', () => {
    const wrapper = mountWithApp(RecentLoginCard, {
      props: {
        entry: recentLogin({
          service: 'WEBUI',
          internal: true,
          clientAddress: '192.168.1.20',
          country: null,
          appPassword: { id: 4, name: null },
          lastSeenAt: '2026-10-20T08:00:00Z',
        }),
      },
    })
    expect(wrapper.text()).toContain('Web/EAS/Internal (192.168.1.20)')
    expect(wrapper.text()).toContain('App')
    expect(wrapper.find('a').exists()).toBe(false)
  })
  it('omits missing country and preserves an unknown country code', async () => {
    const wrapper = mountWithApp(RecentLoginCard, {
      props: {
        entry: recentLogin({ service: 'IMAP', country: null, lastSeenAt: '2026-10-20T08:00:00Z' }),
      },
    })
    expect(wrapper.find('[data-country]').exists()).toBe(false)
    await wrapper.setProps({
      entry: recentLogin({ service: 'IMAP', country: 'XX', lastSeenAt: '2026-10-20T08:00:00Z' }),
    })
    expect(wrapper.get('[data-country]').text()).toBe('XX')
  })
})

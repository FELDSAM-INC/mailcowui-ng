import { describe, expect, it } from 'vitest'
import ClientSetupGuide from '@/features/account/components/mail-apps/ClientSetupGuide.vue'
import { clientConfiguration } from '../../../mocks/factories/client-configuration'
import { mountWithApp } from '../../support/mount'

describe('ClientSetupGuide', () => {
  it('pairs each mail port with its encryption and shows only supplied groupware protocols', () => {
    const wrapper = mountWithApp(ClientSetupGuide, {
      props: {
        configuration: clientConfiguration({
          address: 'anna@example.org',
          displayName: 'Anna',
          groupware: false,
        }),
        protocolAccess: {
          imap: true,
          pop3: false,
          smtp: true,
          sieve: true,
          activeSync: true,
          dav: true,
        },
      },
    })
    expect(wrapper.text()).toContain('SSL/TLS')
    expect(wrapper.text()).toContain('STARTTLS')
    expect(wrapper.text()).toContain('993')
    expect(wrapper.text()).toContain('143')
    expect(wrapper.text()).toContain('Only an app password that allows POP3 works here.')
    expect(wrapper.find('[data-protocol="caldav"]').exists()).toBe(false)
    expect(wrapper.find('[data-protocol="activeSync"]').exists()).toBe(false)
    expect(wrapper.findAll('button').length).toBeGreaterThan(8)
  })
  it('shows DAV paths and ActiveSync URL; omits unavailable ports', () => {
    const configuration = clientConfiguration({
      address: 'anna@example.org',
      displayName: 'Anna',
      groupware: true,
    })
    configuration.imap.starttlsPort = null
    const wrapper = mountWithApp(ClientSetupGuide, { props: { configuration } })
    expect(wrapper.get('[data-protocol="caldav"]').text()).toContain('/SOGo/dav/anna@example.org/')
    expect(wrapper.get('[data-protocol="activeSync"]').text()).toContain(
      'https://mail.example.net/Microsoft-Server-ActiveSync',
    )
    expect(wrapper.get('[data-protocol="imap"]').text()).not.toContain('STARTTLS')
  })
})

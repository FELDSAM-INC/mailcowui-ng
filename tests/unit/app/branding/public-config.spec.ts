// Branding from GET /public-config (FR-001–FR-004, research R16, R17).
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { PublicConfig } from '@/api'
import { brandingFrom, logoFor, useBranding } from '@/app/branding/public-config'
import { defaultBranding } from '@/app/branding/defaults'
import { applyTheme } from '@/app/preferences/theme'

import { useScenario } from '../../../mocks/node'
import { publicConfig } from '../../../mocks/scenarios/public-config'
import { mountWithApp } from '../../support/mount'

describe('branding', () => {
  it('takes the operator values from the configuration', () => {
    const config = publicConfig('default')
    const branding = brandingFrom(config)
    expect(branding.productName).toBe(config.productName)
    expect(branding.pageTitle).toBe(config.pageTitle)
    expect(branding.appLinks).toEqual(config.appLinks)
    expect(branding.announcement).toEqual({ text: config.announcement.text, type: 'warning' })
    expect(branding.fromServer).toBe(true)
  })

  it('shows the announcement only when active and with text (FR-048)', () => {
    const base = publicConfig('default')
    const inactive: PublicConfig = {
      ...base,
      announcement: { ...base.announcement, active: false },
    }
    const empty: PublicConfig = {
      ...base,
      announcement: { text: null, type: 'info', active: true },
    }
    const untyped: PublicConfig = {
      ...base,
      announcement: { text: 'Hello', type: null, active: true },
    }
    expect(brandingFrom(inactive).announcement).toBeNull()
    expect(brandingFrom(empty).announcement).toBeNull()
    expect(brandingFrom(untyped).announcement).toEqual({ text: 'Hello', type: null })
  })

  it('chooses the logo for the active theme', () => {
    const branding = brandingFrom(publicConfig('default'))
    expect(logoFor(branding, false)).toContain('/logos/light')
    expect(logoFor(branding, true)).toContain('/logos/dark')
  })

  it('falls back to neutral defaults with the host name (FR-003)', () => {
    const branding = defaultBranding('mail.example.net')
    expect(branding).toMatchObject({
      productName: 'mail.example.net',
      pageTitle: 'mail.example.net',
      logos: { light: null, dark: null },
      loginHelpHtml: null,
      footerHtml: null,
      announcement: null,
      appLinks: [],
      appsLabel: null,
      languages: null,
      externalIdentityProvider: false,
      fromServer: false,
    })
    expect(branding.loginPage).toEqual({
      hideAdminLogin: false,
      hideDomainAdminLogin: false,
      hideMailboxUserLogin: false,
      forceSingleSignOn: false,
    })
    expect(defaultBranding().productName).toBe(window.location.hostname)
  })
})

describe('useBranding', () => {
  function mountBranding() {
    let api!: ReturnType<typeof useBranding>
    const wrapper = mountWithApp(
      defineComponent({
        setup() {
          api = useBranding()
          return () =>
            h('div', [
              h('span', { class: 'name' }, api.branding.value.productName),
              h('span', { class: 'logo' }, api.logo.value ?? ''),
            ])
        },
      }),
    )
    return { wrapper, api: () => api }
  }

  it('re-chooses the logo when the theme changes', async () => {
    useScenario('anonymous-default')
    applyTheme('light')
    const { wrapper } = mountBranding()
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('.logo').text()).toContain('/logos/light'))
    applyTheme('dark')
    await flushPromises()
    expect(wrapper.find('.logo').text()).toContain('/logos/dark')
  })

  it('never interprets plain-text fields as HTML', async () => {
    useScenario('anonymous-default', {
      publicConfig: { productName: '<img src=x onerror=alert(1)>Mail' },
    })
    const { wrapper } = mountBranding()
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.find('.name').text()).toBe('<img src=x onerror=alert(1)>Mail'),
    )
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('uses the defaults when the configuration cannot be loaded', async () => {
    useScenario('config-unavailable')
    const { wrapper } = mountBranding()
    await flushPromises()
    expect(wrapper.find('.name').text()).toBe(window.location.hostname)
    expect(wrapper.find('.logo').text()).toBe('')
  })
})

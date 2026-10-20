import { beforeEach, describe, expect, it } from 'vitest'
import BrandPreview from '@/features/system-settings/components/branding/BrandPreview.vue'
import { loadFeatureMessages } from '@/i18n'
import { mountWithApp } from '../../../../support/mount'

beforeEach(() => loadFeatureMessages('system-settings'))
describe('BrandPreview', () => {
  it('sets CSSOM only on its container and shows all five preview elements', () => {
    const wrapper = mountWithApp(BrandPreview, {
      props: { theme: 'light', colour: '#1d4ed8', surface: '#ffffff', minimum: 4.5 },
    })
    expect(
      wrapper.get<HTMLElement>('[data-brand-preview]').element.style.getPropertyValue('--accent'),
    ).toBe('#1d4ed8')
    expect(document.documentElement.style.getPropertyValue('--brand-light')).toBe('')
    for (const part of ['header', 'button', 'link', 'navigation', 'switch'])
      expect(wrapper.find(`[data-preview-${part}]`).exists()).toBe(true)
  })
  it('explains the dark fallback and keeps a failing draft out of interactive control colours', () => {
    const wrapper = mountWithApp(BrandPreview, {
      props: {
        theme: 'dark',
        colour: '#1d4ed8',
        surface: '#1d2939',
        minimum: 4.5,
        inherited: true,
      },
    })
    expect(wrapper.text()).toContain('default palette')
    expect(wrapper.text()).toContain('2.2:1')
    expect(
      wrapper.get<HTMLElement>('[data-brand-preview]').element.style.getPropertyValue('--accent'),
    ).not.toBe('#1d4ed8')
  })
  it('explains when a light colour also passes the dark reference', () => {
    const wrapper = mountWithApp(BrandPreview, {
      props: {
        theme: 'dark',
        colour: '#767676',
        surface: '#000000',
        minimum: 4.5,
        inherited: true,
      },
    })
    expect(wrapper.text()).toContain('dark theme uses the light theme colour')
    expect(
      wrapper.get<HTMLElement>('[data-brand-preview]').element.style.getPropertyValue('--accent'),
    ).toBe('#767676')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import BrandPreview from '@/features/system-settings/components/branding/BrandPreview.vue'
import { adjust } from '@/shared/color/contrast'
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
  it('keeps bright yellow on controls and derives the text-only link colour', () => {
    const wrapper = mountWithApp(BrandPreview, {
      props: { theme: 'light', colour: '#febc23', surface: '#ffffff', minimum: 4.5 },
    })
    const style = wrapper.get<HTMLElement>('[data-brand-preview]').element.style
    expect(style.getPropertyValue('--accent')).toBe('#febc23')
    expect(style.getPropertyValue('--accent-foreground')).toBe('#000000')
    expect(style.getPropertyValue('--accent-text')).toBe(adjust('#febc23', '#ffffff', 4.5))
    expect(wrapper.text()).toContain('12.4:1')
  })
  it('uses an inherited dark accent with a separately adjusted link colour', () => {
    const wrapper = mountWithApp(BrandPreview, {
      props: {
        theme: 'dark',
        colour: '#1d4ed8',
        surface: '#222932',
        minimum: 4.5,
        inherited: true,
      },
    })
    const style = wrapper.get<HTMLElement>('[data-brand-preview]').element.style
    expect(style.getPropertyValue('--accent')).toBe('#1d4ed8')
    expect(style.getPropertyValue('--accent-text')).toBe(adjust('#1d4ed8', '#222932', 4.5))
    expect(wrapper.text()).toContain('dark theme uses the light theme colour')
  })
})

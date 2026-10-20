import { beforeEach, describe, expect, it } from 'vitest'
import HtmlFieldPreview from '@/features/system-settings/components/branding/HtmlFieldPreview.vue'
import { loadFeatureMessages } from '@/i18n'
import { mountWithApp } from '../../../support/mount'

beforeEach(() => loadFeatureMessages('system-settings'))
describe('operator HTML preview', () => {
  it('renders only the shared allowlist and names removed kinds without changing the source', () => {
    const html =
      '<p onclick="alert(1)">Hello <a href="https://example.org">help</a><script>alert(1)</script><img src="evil"></p>'
    const wrapper = mountWithApp(HtmlFieldPreview, { props: { html } })
    expect(wrapper.find('p').text()).toContain('Hello')
    expect(wrapper.get('a').attributes('href')).toBe('https://example.org')
    expect(wrapper.find('img, script, [onclick]').exists()).toBe(false)
    expect(wrapper.get('[data-html-removed]').text()).toMatch(/scripts.*images.*event handlers/)
    expect(wrapper.text()).toContain('classic interface')
    expect(wrapper.props('html')).toBe(html)
  })
  it('describes an empty field and removes an obsolete warning when the draft becomes safe', async () => {
    const wrapper = mountWithApp(HtmlFieldPreview, { props: { html: '<script>bad()</script>' } })
    await wrapper.setProps({ html: '' })
    expect(wrapper.find('[data-html-removed]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nothing is shown')
  })
})

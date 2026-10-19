// UI 011 (research R11): untrusted text is shown as text, with control characters and bidi
// overrides as visible markers, line breaks kept only when multi-line, and never as markup.
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PlainText from '@/shared/components/PlainText.vue'

describe('PlainText', () => {
  it('never interprets markup', () => {
    const wrapper = mount(PlainText, { props: { value: '<b onclick="x()">bold</b>' } })
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.text()).toBe('<b onclick="x()">bold</b>')
  })

  it('shows bidi overrides and control characters as markers', () => {
    const wrapper = mount(PlainText, { props: { value: 'abc‮def\u0007' } })
    const markers = wrapper.findAll('[data-marker]').map((marker) => marker.text())
    expect(markers).toEqual(['U+202E', 'U+0007'])
    expect(wrapper.attributes('dir')).toBe('auto')
  })

  it('keeps line breaks when multi-line, and marks them otherwise', () => {
    const multi = mount(PlainText, { props: { value: 'one\r\ntwo', multiline: true, as: 'div' } })
    expect(multi.element.tagName).toBe('DIV')
    expect(multi.text()).toBe('one\ntwo')
    expect(multi.classes()).toContain('whitespace-pre-wrap')
    const single = mount(PlainText, { props: { value: 'one\ntwo' } })
    expect(single.find('[data-marker]').text()).toBe('U+000A')
  })

  it('wraps long tokens at any character and renders nothing for null', () => {
    const wrapper = mount(PlainText, { props: { value: null } })
    expect(wrapper.classes()).toContain('wrap-anywhere')
    expect(wrapper.text()).toBe('')
  })
})

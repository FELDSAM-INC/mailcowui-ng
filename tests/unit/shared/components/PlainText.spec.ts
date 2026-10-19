// UI 011 (research R11): untrusted text is shown as text, with control characters and bidi
// overrides as visible markers, line breaks kept only when multi-line, and never as markup.
import { mountWithApp as mount } from '../../support/mount'
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
    expect(markers).toEqual(['Control character U+202E', 'Control character U+0007'])
    expect(wrapper.attributes('dir')).toBe('auto')
  })

  it('keeps line breaks when multi-line, and marks them otherwise', () => {
    const multi = mount(PlainText, { props: { value: 'one\r\ntwo', multiline: true, as: 'div' } })
    expect(multi.element.tagName).toBe('DIV')
    expect(multi.text()).toBe('one\ntwo')
    expect(multi.classes()).toContain('whitespace-pre-wrap')
    const single = mount(PlainText, { props: { value: 'one\ntwo' } })
    expect(single.find('[data-marker]').text()).toContain('U+000A')
  })

  it('wraps long tokens at any character and renders nothing for null', () => {
    const wrapper = mount(PlainText, { props: { value: null } })
    expect(wrapper.classes()).toContain('wrap-anywhere')
    expect(wrapper.text()).toBe('')
  })
})

const RLO = String.fromCodePoint(0x202e)

describe('PlainText', () => {
  it('renders a single-line value in one bdi', () => {
    const wrapper = mount(PlainText, { props: { value: 'Invoice 42' } })
    expect(wrapper.element.tagName).toBe('BDI')
    expect(wrapper.element.textContent).toBe('Invoice 42')
  })

  it('renders a multi-line value in a dir="auto" block that keeps line breaks', () => {
    const wrapper = mount(PlainText, {
      props: { value: 'one\r\ntwo', multiline: true },
    })
    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.attributes('dir')).toBe('auto')
    expect(wrapper.classes()).toContain('whitespace-pre-wrap')
    expect(wrapper.element.textContent).toBe('one\ntwo')
  })

  it('shows an override as a visible marker with an accessible name', () => {
    const wrapper = mount(PlainText, { props: { value: `invoice${RLO}fdp.exe` } })
    const marker = wrapper.get('[data-marker]')
    expect(marker.text()).toContain('U+202E')
    expect(marker.text()).toContain('Control character')
    expect(wrapper.text()).not.toContain(RLO)
  })

  it('never creates elements from markup in the data', () => {
    const value =
      '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:x">y</a>'
    for (const multiline of [false, true]) {
      const wrapper = mount(PlainText, { props: { value, multiline } })
      expect(wrapper.element.querySelectorAll('script, img, a, style, svg, iframe')).toHaveLength(0)
      expect(wrapper.text()).toContain('<script>alert(1)</script>')
    }
  })

  it('renders null as nothing', () => {
    const wrapper = mount(PlainText, { props: { value: null } })
    expect(wrapper.text()).toBe('')
  })
})

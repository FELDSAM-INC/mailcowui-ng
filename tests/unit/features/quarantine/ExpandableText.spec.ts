import { describe, expect, it } from 'vitest'
import ExpandableText from '@/features/quarantine/components/item/ExpandableText.vue'
import { mountWithApp } from '../../support/mount'

describe('message metadata preview', () => {
  it('bounds the initial marker count and exposes the complete value only after expansion', async () => {
    const text = Array.from({ length: 5000 }, (_, index) => `line ${index}`).join('\n')
    const wrapper = mountWithApp(ExpandableText, { props: { value: text } })
    expect(wrapper.findAll('[data-marker]')).toHaveLength(19)
    expect(wrapper.text()).not.toContain('line 4999')
    const button = wrapper.get('button')
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.text()).toContain('line 4999')
    await button.trigger('click')
    expect(wrapper.findAll('[data-marker]')).toHaveLength(19)
    wrapper.unmount()
  })
  it('keeps short markup inert without adding an unnecessary control', () => {
    const wrapper = mountWithApp(ExpandableText, {
      props: { value: '<img src=x onerror=alert(1)>' },
    })
    expect(wrapper.text()).toBe('<img src=x onerror=alert(1)>')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
})

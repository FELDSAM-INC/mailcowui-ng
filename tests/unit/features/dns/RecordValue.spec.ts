// A labelled DNS value with its copy button (UI 010 T013, research R6, FR-018): monospace text that
// wraps anywhere, so a 1,000-character value never scrolls sideways, and the copy button named by
// what it copies, with the value element as the place to select on a refusal.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import RecordValue from '@/features/dns/components/RecordValue.vue'
import CopyButton from '@/shared/components/CopyButton.vue'

import { mountWithApp } from '../../support/mount'

describe('RecordValue', () => {
  it('shows the label and the value as monospace text that wraps anywhere', () => {
    const value = `v=DKIM1;k=rsa;t=s;s=email;p=${'A'.repeat(1000)}`
    const wrapper = mountWithApp(RecordValue, {
      props: { label: 'Value', value, copyLabel: 'Copy record value of example.org' },
    })
    expect(wrapper.text()).toContain('Value')
    const code = wrapper.get('[data-record-value]')
    expect(code.element.tagName).toBe('CODE')
    expect(code.text()).toBe(value)
    expect(code.classes()).toEqual(expect.arrayContaining(['font-mono', 'wrap-anywhere']))
    const button = wrapper.getComponent(CopyButton)
    expect(button.props('text')).toBe(value)
    expect(button.props('label')).toBe('Copy record value of example.org')
  })

  it('renders a multi-line value in a pre and passes it as the select target', async () => {
    const wrapper = mountWithApp(RecordValue, {
      props: { label: 'Zone', value: 'a\nb\n', copyLabel: 'Copy zone file', multiline: true },
      attachTo: document.body,
    })
    await flushPromises()
    const pre = wrapper.get('pre[data-record-value]')
    expect(pre.text()).toBe('a\nb')
    expect(wrapper.getComponent(CopyButton).props('selectTarget')).toBe(pre.element)
    wrapper.unmount()
  })

  it('omits the copy button when asked', () => {
    vi.fn()
    const wrapper = mountWithApp(RecordValue, {
      props: { label: 'Found', value: 'x', copyLabel: 'unused', copy: false },
    })
    expect(wrapper.findComponent(CopyButton).exists()).toBe(false)
  })
})

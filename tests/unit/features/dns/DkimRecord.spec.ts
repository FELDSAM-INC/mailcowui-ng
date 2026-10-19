// The DKIM record of an entry (T035, research R7, FR-016, FR-017): record name, host label and
// value with copy buttons named after what they copy, one form at a time, and the copy target
// following the chosen form.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DkimRecord from '@/features/dns/components/DkimRecord.vue'
import CopyButton from '@/shared/components/CopyButton.vue'

import { mountWithApp } from '../../support/mount'
import { dkimEntry } from './fixtures'

describe('DkimRecord', () => {
  it('shows the record name, host label and value with named copy buttons', () => {
    const entry = dkimEntry()
    const wrapper = mountWithApp(DkimRecord, { props: { entry } })
    expect(wrapper.text()).toContain('dkim._domainkey.example.org')
    expect(wrapper.text()).toContain('dkim._domainkey')
    const labels = wrapper.findAllComponents(CopyButton).map((button) => button.props('label'))
    expect(labels).toEqual([
      'Copy record name of example.org',
      'Copy host label of example.org',
      'Copy record value of example.org',
    ])
    expect(wrapper.findAllComponents(CopyButton)[2]!.props('text')).toBe(entry.key!.record!.value)
  })

  it('switches to the split form, and copies that form', async () => {
    const entry = dkimEntry()
    const wrapper = mountWithApp(DkimRecord, { props: { entry }, attachTo: document.body })
    const split = wrapper.findAll('[role="radio"]')[1]!
    await split.trigger('click')
    await flushPromises()
    const parts = entry.key!.record!.valueParts
    const expected = `"${parts[0]}" "${parts[1]}"`
    expect(wrapper.findAllComponents(CopyButton)[2]!.props('text')).toBe(expected)
    expect(wrapper.get('[data-record-form="split"] [data-record-value]').text()).toBe(expected)
    wrapper.unmount()
  })
})

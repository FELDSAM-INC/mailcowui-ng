// The goto part of the alias forms (T043; legacy form map): the textarea and legacy's three
// mutually exclusive goto checkboxes, which disable the textarea without losing its text, entry
// errors, and the external destination notice.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import DestinationField from '@/features/aliases/components/DestinationField.vue'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { mountWithApp } from '../../support/mount'

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

const mountField = (props: Record<string, unknown> = {}) =>
  mountWithApp(DestinationField, {
    props: {
      id: 'goto',
      labelKey: 'add.target_address',
      helpKey: 'add.target_address_info',
      destinationsText: 'anna@example.org',
      gotoAction: 'none',
      ...props,
    },
  })

describe('DestinationField', () => {
  it('has the goto textarea with its help and the three goto checkboxes in legacy order', () => {
    const wrapper = mountField()
    expect(wrapper.get('label[for="goto"]').text()).toContain('Goto addresses')
    expect(wrapper.text()).toContain('Full email address/es (comma-separated).')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(3)
    expect(wrapper.text()).toMatch(/Silently discard mail.*Learn as spam.*Learn as ham/s)
  })

  it('checking a goto box chooses it and disables the textarea, which keeps its text', async () => {
    const wrapper = mountField()
    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)
    expect(wrapper.emitted('update:gotoAction')?.[0]).toEqual(['learnSpam'])
    await wrapper.setProps({ gotoAction: 'learnSpam' })
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('anna@example.org')
    expect(
      (wrapper.findAll('input[type="checkbox"]')[0]!.element as HTMLInputElement).checked,
    ).toBe(false)
    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(false)
    expect(wrapper.emitted('update:gotoAction')?.[1]).toEqual(['none'])
  })

  it('shows entry errors and the external notice', () => {
    const wrapper = mountField({
      destinationsText: 'anna@example.org, x@outside.example',
      entryErrors: { 1: ['External goto address x@outside.example is not allowed'] },
      restricted: true,
    })
    expect(wrapper.text()).toContain('External goto address x@outside.example is not allowed')
    expect(wrapper.find('[data-external-notice]').exists()).toBe(true)
  })
})

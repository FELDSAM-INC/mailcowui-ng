// The display and field components UI 004 promotes from UI 002 at their second use (T009, research
// D12, D13): DomainNameText, DkimFields, LegacyRateLimitField (promoted by UI 003; UI 004 adds `frames`) and CreationReport, prop-driven so that
// both features pass their own capabilities and values.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { legacy } from '@/i18n'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'
import CreationReport from '@/shared/components/CreationReport.vue'
import DkimFields from '@/shared/components/DkimFields.vue'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import LegacyRateLimitField from '@/shared/components/LegacyRateLimitField.vue'

import { mountWithApp } from '../../support/mount'

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

describe('DomainNameText', () => {
  it('shows the readable name, and the ASCII name only when it differs', () => {
    const idn = mountWithApp(DomainNameText, {
      props: { name: 'xn--bcher-kva.example', unicodeName: 'bücher.example' },
    })
    expect(idn.text()).toBe('bücher.example xn--bcher-kva.example'.replace(' ', ''))
    const plain = mountWithApp(DomainNameText, {
      props: { name: 'example.org', unicodeName: 'example.org' },
    })
    expect(plain.findAll('span span')).toHaveLength(1)
  })
})

describe('DkimFields', () => {
  it('has the selector input and a key size select from the keySizes prop', async () => {
    const wrapper = mountWithApp(DkimFields, {
      props: { idPrefix: 'ad', selector: 'feldhost', keySize: 2048, keySizes: [1024, 2048] },
    })
    const input = wrapper.get('input')
    expect(input.attributes('autocapitalize')).toBe('none')
    expect((input.element as HTMLInputElement).value).toBe('feldhost')
    expect(wrapper.text()).toContain('Selector')
    expect(wrapper.text()).toContain('DKIM key length (bits)')
    const options = wrapper.findAll('option').map((option) => option.text())
    expect(options).toEqual(['1024', '2048'])
    await input.setValue('')
    expect(wrapper.emitted('update:selector')?.at(-1)).toEqual([''])
    await wrapper.get('select').setValue('1024')
    expect(wrapper.emitted('update:keySize')?.at(-1)).toEqual([1024])
  })
})

describe('LegacyRateLimitField with frames', () => {
  it('takes a whole number and a frame from the frames prop, empty meaning none', async () => {
    const wrapper = mountWithApp(LegacyRateLimitField, {
      props: {
        idPrefix: 'rl',
        value: '',
        frame: 'hour',
        frames: ['minute', 'hour'],
        labelKey: 'acl.ratelimit',
      },
    })
    const input = wrapper.get('input')
    expect(input.attributes('inputmode')).toBe('numeric')
    expect(input.attributes('placeholder')).toBe('Disabled')
    expect(wrapper.text()).toContain('Rate limit')
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual([
      'msgs / minute',
      'msgs / hour',
    ])
    await input.setValue('10')
    expect(wrapper.emitted('update:value')?.at(-1)).toEqual(['10'])
  })
})

describe('CreationReport', () => {
  it('shows one alert per outcome by kind, with icon and text, and can be dismissed', async () => {
    const wrapper = mountWithApp(CreationReport, {
      props: {
        alerts: [
          { kind: 'success', text: legacy('success.aliasd_added', 'example.net'), params: [] },
          { kind: 'warning', text: 'domains.outcome.dkimDnsNoZone', params: ['example.net'] },
        ],
      },
    })
    const items = wrapper.findAll('[data-alert]')
    expect(items.map((item) => item.attributes('data-alert'))).toEqual(['success', 'warning'])
    expect(items[0]!.text()).toBe('Added alias domain example.net')
    expect(items[1]!.text()).toContain('example.net')
    expect(items[0]!.find('svg').exists()).toBe(true)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})

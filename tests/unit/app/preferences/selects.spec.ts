// T118: the language and theme choices (FR-058, FR-060): languages by native name without flags,
// hidden with fewer than two; three labelled themes.
import { describe, expect, it } from 'vitest'

import LanguageSelect from '@/app/preferences/LanguageSelect.vue'
import ThemeSelect from '@/app/preferences/ThemeSelect.vue'
import { usePreferencesStore } from '@/app/preferences/store'

import { mountWithApp } from '../../support/mount'

describe('LanguageSelect', () => {
  it('lists the available languages by native name, without flags', () => {
    usePreferencesStore().setServerLanguages(
      [
        { code: 'sk-sk', name: 'Slovenčina' },
        { code: 'en-gb', name: 'English' },
        { code: 'cs-cz', name: 'Čeština' },
        { code: 'de-de', name: 'Deutsch' },
      ],
      'en-gb',
    )
    const wrapper = mountWithApp(LanguageSelect)
    const select = wrapper.get('select')
    expect(wrapper.get(`label[for="${select.attributes('id')}"]`).text()).toBe('Language')
    expect(select.findAll('option').map((o) => [o.text(), o.attributes('lang')])).toEqual([
      ['English', 'en-GB'],
      ['Čeština', 'cs-CZ'],
      ['Slovenčina', 'sk-SK'],
    ])
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('is hidden with fewer than two languages', () => {
    usePreferencesStore().setServerLanguages([{ code: 'en-gb', name: 'English' }], 'en-gb')
    expect(mountWithApp(LanguageSelect).find('select').exists()).toBe(false)
  })
})

describe('ThemeSelect', () => {
  it('offers light, dark and the device setting', () => {
    const wrapper = mountWithApp(ThemeSelect)
    const select = wrapper.get('select')
    expect(wrapper.get(`label[for="${select.attributes('id')}"]`).text()).toBe('Theme')
    expect(select.findAll('option').map((o) => [o.attributes('value'), o.text()])).toEqual([
      ['light', 'Light'],
      ['dark', 'Dark'],
      ['system', 'Device setting'],
    ])
  })
})

// T118: the language and theme choices (FR-058, FR-060): languages by the names of mailcow's
// language menu, in its order and without flags, hidden with fewer than two; three labelled themes.
import { describe, expect, it } from 'vitest'

import LanguageSelect from '@/app/preferences/LanguageSelect.vue'
import ThemeSelect from '@/app/preferences/ThemeSelect.vue'
import { usePreferencesStore } from '@/app/preferences/store'

import { mountWithApp } from '../../support/mount'

describe('LanguageSelect', () => {
  it("lists the available languages by the server's names, in its order, without flags", () => {
    usePreferencesStore().setServerLanguages(
      [
        { code: 'sk-sk', name: 'Slovenčina (Slovak)' },
        { code: 'en-gb', name: 'English' },
        { code: 'gr-gr', name: 'Ελληνικά (Greek)' },
        { code: 'en-us', name: 'English (US)' },
      ],
      'en-gb',
    )
    const wrapper = mountWithApp(LanguageSelect)
    const select = wrapper.get('select')
    expect(wrapper.get(`label[for="${select.attributes('id')}"]`).text()).toBe('Language')
    expect(select.findAll('option').map((o) => [o.text(), o.attributes('lang')])).toEqual([
      ['Slovenčina (Slovak)', 'sk-SK'],
      ['English', 'en-GB'],
      ['Ελληνικά (Greek)', 'el-GR'],
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

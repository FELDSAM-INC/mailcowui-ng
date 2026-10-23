// Public auth preferences use the same flagged menus as the signed-in shell.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import LanguageSelect from '@/app/preferences/LanguageSelect.vue'
import ThemeSelect from '@/app/preferences/ThemeSelect.vue'
import { usePreferencesStore } from '@/app/preferences/store'

import { mountWithApp } from '../../support/mount'

describe('LanguageSelect', () => {
  it('shows the current language and offers server languages with flags and native names', async () => {
    const prefs = usePreferencesStore()
    prefs.setServerLanguages(
      [
        { code: 'sk-sk', name: 'Slovenčina (Slovak)' },
        { code: 'en-gb', name: 'English' },
        { code: 'gr-gr', name: 'Ελληνικά (Greek)' },
        { code: 'en-us', name: 'English (US)' },
      ],
      'en-gb',
    )
    const wrapper = mountWithApp(LanguageSelect, { attachTo: document.body })
    const trigger = wrapper.get('button[aria-label="Language"]')
    expect(trigger.text()).toContain('English')
    expect(trigger.text()).toContain('🇬🇧')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const options = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
    expect(options.map((option) => [option.textContent?.trim(), option.lang])).toEqual([
      ['🇸🇰 Slovenčina (Slovak)', 'sk-SK'],
      ['🇬🇧 English', 'en-GB'],
      ['🇬🇷 Ελληνικά (Greek)', 'el-GR'],
    ])
    expect(options[1]?.getAttribute('aria-checked')).toBe('true')
    options[0]!.click()
    await vi.waitFor(() => expect(prefs.locale).toBe('sk-sk'))
    expect(trigger.text()).toContain('Slovenčina (Slovak)')
    expect(document.documentElement.lang).toBe('sk-SK')
    wrapper.unmount()
  })

  it('is hidden with fewer than two languages', () => {
    usePreferencesStore().setServerLanguages([{ code: 'en-gb', name: 'English' }], 'en-gb')
    const wrapper = mountWithApp(LanguageSelect)
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('ThemeSelect', () => {
  it('offers light, dark and the device setting in a keyboard-accessible menu', async () => {
    const prefs = usePreferencesStore()
    prefs.setTheme('light')
    const wrapper = mountWithApp(ThemeSelect, { attachTo: document.body })
    const trigger = wrapper.get('button[aria-label="Theme"]')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const options = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Light',
      'Dark',
      'Device setting',
    ])
    expect(options[0]?.getAttribute('aria-checked')).toBe('true')
    options[1]!.click()
    await vi.waitFor(() => expect(prefs.theme).toBe('dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    wrapper.unmount()
  })
})

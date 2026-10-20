import { flushPromises } from '@vue/test-utils'
import { expect, it } from 'vitest'
import ThemeToggle from '@/app/preferences/ThemeToggle.vue'
import { usePreferencesStore } from '@/app/preferences/store'
import { localeFlag } from '@/app/preferences/locale-flag'
import { APP_LOCALES } from '@/i18n/locales'
import { mountWithApp } from '../../support/mount'

it('switches the current theme directly without opening the account menu', async () => {
  const prefs = usePreferencesStore()
  prefs.setTheme('light')
  const wrapper = mountWithApp(ThemeToggle)
  expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('false')
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(prefs.theme).toBe('dark')
  expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true')
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(prefs.theme).toBe('light')
  wrapper.unmount()
})

it('decorates every supported language with the flag of its locale region', () => {
  expect(localeFlag('en-gb')).toBe('🇬🇧')
  expect(localeFlag('cs-cz')).toBe('🇨🇿')
  expect(localeFlag('sk-sk')).toBe('🇸🇰')
  expect(APP_LOCALES.every((locale) => [...localeFlag(locale)].length === 2)).toBe(true)
  expect(localeFlag('not-a-locale')).toBe('')
})

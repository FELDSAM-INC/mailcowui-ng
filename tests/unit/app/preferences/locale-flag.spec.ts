import { expect, it } from 'vitest'
import { localeFlag } from '@/app/preferences/locale-flag'
import { APP_LOCALES } from '@/i18n/locales'

it('decorates every supported language with the flag of its locale region', () => {
  expect(localeFlag('en-gb')).toBe('🇬🇧')
  expect(localeFlag('cs-cz')).toBe('🇨🇿')
  expect(localeFlag('sk-sk')).toBe('🇸🇰')
  expect(APP_LOCALES.every((locale) => [...localeFlag(locale)].length === 2)).toBe(true)
  expect(localeFlag('not-a-locale')).toBe('')
})

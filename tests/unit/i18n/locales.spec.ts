// The app's locales (constitution IV 1.3.0, research R15): every language mailcow ships, with
// mailcow's codes, converted to BCP 47 only for Intl and `<html lang>`.
import { describe, expect, it } from 'vitest'

import { formatDateTime, formatNumber } from '@/i18n/format'
import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  isAppLocale,
  matchBrowserLanguage,
  MESSAGE_LOCALES,
  toBcp47,
} from '@/i18n/locales'

describe('APP_LOCALES', () => {
  it("are mailcow's 33 language codes", () => {
    expect(APP_LOCALES).toEqual([
      'az-az',
      'bg-bg',
      'ca-es',
      'cs-cz',
      'da-dk',
      'de-de',
      'en-gb',
      'es-es',
      'fi-fi',
      'fr-fr',
      'gr-gr',
      'hu-hu',
      'it-it',
      'ja-jp',
      'ko-kr',
      'lt-lt',
      'lv-lv',
      'nb-no',
      'nl-nl',
      'pl-pl',
      'pt-br',
      'pt-pt',
      'ro-ro',
      'ru-ru',
      'si-si',
      'sk-sk',
      'sv-se',
      'tr-tr',
      'uk-ua',
      'uz-uz',
      'vi-vn',
      'zh-cn',
      'zh-tw',
    ])
    expect(DEFAULT_LOCALE).toBe('en-gb')
    expect(isAppLocale('ja-jp')).toBe(true)
    expect(isAppLocale('en-us')).toBe(false)
  })

  it('carry new strings in English, Czech and Slovak only', () => {
    expect(MESSAGE_LOCALES).toEqual(['en-gb', 'cs-cz', 'sk-sk'])
  })
})

describe('toBcp47', () => {
  it('upper-cases the region', () => {
    expect(toBcp47('en-gb')).toBe('en-GB')
    expect(toBcp47('zh-tw')).toBe('zh-TW')
    expect(toBcp47('pt-br')).toBe('pt-BR')
  })

  it("maps mailcow's Greek and Slovenian codes to their ISO 639 languages", () => {
    expect(toBcp47('gr-gr')).toBe('el-GR')
    expect(toBcp47('si-si')).toBe('sl-SI')
  })

  it('gives Intl a language it formats in', () => {
    const date = new Date(Date.UTC(2026, 0, 15, 12))
    expect(formatDateTime(date, 'gr-gr', 'date')).toBe(
      new Intl.DateTimeFormat('el-GR', { dateStyle: 'medium' }).format(date),
    )
    expect(formatNumber(1234.5, 'si-si')).toBe(new Intl.NumberFormat('sl-SI').format(1234.5))
  })
})

describe('matchBrowserLanguage', () => {
  const available = ['en-gb', 'pt-pt', 'pt-br', 'zh-cn', 'zh-tw', 'gr-gr', 'si-si'] as const

  it('prefers an exact match, then the same language', () => {
    expect(matchBrowserLanguage('pt-BR', available)).toBe('pt-br')
    expect(matchBrowserLanguage('zh-TW', available)).toBe('zh-tw')
    expect(matchBrowserLanguage('pt', available)).toBe('pt-pt')
    expect(matchBrowserLanguage('en-US', available)).toBe('en-gb')
  })

  it("matches the browser's ISO codes for mailcow's Greek and Slovenian", () => {
    expect(matchBrowserLanguage('el', available)).toBe('gr-gr')
    expect(matchBrowserLanguage('sl-SI', available)).toBe('si-si')
  })

  it('finds nothing for a language that is not available', () => {
    expect(matchBrowserLanguage('de-DE', available)).toBeNull()
  })
})

// Language resolution (FR-060, FR-061, FR-088, research R15): available languages, the order
// before sign-in, the profile language after sign-in, saving per field and the document language.
import { describe, expect, it } from 'vitest'

import type { Language } from '@/api'
import {
  applyLocale,
  canSavePreferences,
  resolveAvailableLocales,
  resolvePreSignInLocale,
  resolveSignedInLocale,
  showLanguageChoice,
} from '@/app/preferences/locale'
import { usePreferencesStore } from '@/app/preferences/store'
import { i18n } from '@/i18n'

const languages = (...codes: string[]): Language[] =>
  codes.map((code) => ({ code, name: `Name of ${code}` }))

describe('available languages (FR-060)', () => {
  it('are the server languages the app translates, in the app order', () => {
    expect(resolveAvailableLocales(languages('sk-sk', 'de-de', 'en-gb'))).toEqual([
      'en-gb',
      'sk-sk',
    ])
    expect(resolveAvailableLocales(languages('cs-cz', 'en-gb', 'sk-sk', 'fr-fr'))).toEqual([
      'en-gb',
      'cs-cz',
      'sk-sk',
    ])
  })

  it('are every app language when the configuration could not be loaded (FR-003)', () => {
    expect(resolveAvailableLocales(null)).toEqual(['en-gb', 'cs-cz', 'sk-sk'])
  })

  it('offer a choice only with more than one language', () => {
    expect(showLanguageChoice(resolveAvailableLocales(languages('cs-cz', 'en-gb')))).toBe(true)
    expect(showLanguageChoice(resolveAvailableLocales(languages('cs-cz')))).toBe(false)
    expect(showLanguageChoice(resolveAvailableLocales(languages('de-de')))).toBe(false)
  })

  it('with none available: English, no choice, no language saved, the theme still saved', () => {
    const available = resolveAvailableLocales(languages('de-de', 'fr-fr'))
    expect(available).toEqual([])
    expect(
      resolvePreSignInLocale({
        remembered: 'cs-cz',
        browserLanguages: ['cs-CZ'],
        serverDefault: 'de-de',
        available,
      }),
    ).toBe('en-gb')
    expect(canSavePreferences('active', available)).toEqual({ locale: false, theme: true })
  })

  it('saves nothing outside an active session', () => {
    const available = resolveAvailableLocales(languages('en-gb', 'cs-cz'))
    expect(canSavePreferences('active', available)).toEqual({ locale: true, theme: true })
    expect(canSavePreferences('restricted', available)).toEqual({ locale: false, theme: false })
    expect(canSavePreferences('anonymous', available)).toEqual({ locale: false, theme: false })
    expect(canSavePreferences(null, available)).toEqual({ locale: false, theme: false })
  })
})

describe('language before sign-in (FR-061)', () => {
  const available = resolveAvailableLocales(languages('en-gb', 'cs-cz', 'sk-sk'))

  it('uses the language remembered on the device first', () => {
    expect(
      resolvePreSignInLocale({
        remembered: 'sk-sk',
        browserLanguages: ['cs-CZ'],
        serverDefault: 'en-gb',
        available,
      }),
    ).toBe('sk-sk')
  })

  it('then the first browser language whose primary subtag is available', () => {
    expect(
      resolvePreSignInLocale({
        remembered: null,
        browserLanguages: ['de-AT', 'cs', 'sk-SK'],
        serverDefault: 'en-gb',
        available,
      }),
    ).toBe('cs-cz')
  })

  it('then the server default, then English', () => {
    expect(
      resolvePreSignInLocale({
        remembered: 'de-de',
        browserLanguages: ['fr-FR'],
        serverDefault: 'sk-sk',
        available,
      }),
    ).toBe('sk-sk')
    expect(
      resolvePreSignInLocale({
        remembered: null,
        browserLanguages: ['fr-FR'],
        serverDefault: 'de-de',
        available,
      }),
    ).toBe('en-gb')
  })

  it('ignores a remembered language the server no longer enables', () => {
    expect(
      resolvePreSignInLocale({
        remembered: 'sk-sk',
        browserLanguages: [],
        serverDefault: 'cs-cz',
        available: resolveAvailableLocales(languages('en-gb', 'cs-cz')),
      }),
    ).toBe('cs-cz')
  })
})

describe('language after sign-in (FR-061)', () => {
  const available = resolveAvailableLocales(languages('en-gb', 'cs-cz', 'sk-sk', 'de-de'))
  const base = { remembered: null, browserLanguages: ['sk-SK'], serverDefault: 'en-gb', available }

  it('applies the profile language', () => {
    expect(
      resolveSignedInLocale({ ...base, profile: 'cs-cz', chosenOnSignIn: null, current: 'en-gb' }),
    ).toEqual({ locale: 'cs-cz', saveToProfile: false })
  })

  it('keeps and saves a language chosen on the sign-in screen during this visit', () => {
    expect(
      resolveSignedInLocale({
        ...base,
        profile: 'cs-cz',
        chosenOnSignIn: 'sk-sk',
        current: 'sk-sk',
      }),
    ).toEqual({ locale: 'sk-sk', saveToProfile: true })
  })

  it('falls back to the pre-sign-in order for an untranslated profile language, without overwriting it', () => {
    expect(
      resolveSignedInLocale({ ...base, profile: 'de-de', chosenOnSignIn: null, current: 'en-gb' }),
    ).toEqual({ locale: 'sk-sk', saveToProfile: false })
  })

  it('never saves a language when none is available', () => {
    expect(
      resolveSignedInLocale({
        ...base,
        available: [],
        profile: 'de-de',
        chosenOnSignIn: 'cs-cz',
        current: 'en-gb',
      }),
    ).toEqual({ locale: 'en-gb', saveToProfile: false })
  })
})

describe('applying a language (FR-059, FR-088)', () => {
  it('switches the messages, sets <html lang> to BCP 47 and remembers it on the device', async () => {
    await applyLocale('cs-cz')
    expect(i18n.global.locale.value).toBe('cs-cz')
    expect(i18n.global.t('nav.home')).toBe('Úvod')
    expect(document.documentElement.lang).toBe('cs-CZ')
    expect(localStorage.getItem('mailcowui-ng.locale')).toBe('cs-cz')
    await applyLocale('en-gb')
    expect(document.documentElement.lang).toBe('en-GB')
  })

  it('keeps working when storage is disabled', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
    try {
      await expect(applyLocale('sk-sk')).resolves.toBeUndefined()
      expect(document.documentElement.lang).toBe('sk-SK')
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original)
    }
  })
})

describe('preferences store', () => {
  it('derives the available languages and the per-field saving from server data', async () => {
    const store = usePreferencesStore()
    expect(store.availableLocales).toEqual(['en-gb', 'cs-cz', 'sk-sk'])
    store.setServerLanguages(languages('de-de'))
    store.setSessionState('active')
    expect(store.availableLocales).toEqual([])
    expect(store.showLanguageChoice).toBe(false)
    expect(store.canSave).toEqual({ locale: false, theme: true })
    await store.setLocale('cs-cz')
    expect(store.locale).toBe('en-gb')
  })

  it('records a choice made before sign-in for this visit', async () => {
    const store = usePreferencesStore()
    store.setSessionState('anonymous')
    await store.setLocale('sk-sk', { chosen: true })
    store.setTheme('dark', { chosen: true })
    expect(store.locale).toBe('sk-sk')
    expect(store.chosenOnSignIn).toEqual({ locale: true, theme: true })
  })

  it('applies the profile after sign-in unless a choice was made on the sign-in screen', async () => {
    const store = usePreferencesStore()
    store.setServerLanguages(languages('en-gb', 'cs-cz', 'sk-sk'))
    store.setSessionState('active')
    const result = await store.applyProfile({ language: 'cs-cz', theme: 'dark', etag: '"1"' })
    expect(store.locale).toBe('cs-cz')
    expect(store.theme).toBe('dark')
    expect(result).toEqual({ saveLocale: false, saveTheme: false })
  })
})

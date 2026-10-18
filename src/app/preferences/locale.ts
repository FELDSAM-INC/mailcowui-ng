// Language resolution (FR-060, FR-061, FR-088, research R15). Pure rules plus `applyLocale`,
// which switches the messages, the document language and the remembered device language.
import type { Language, SessionState } from '@/api'
import { i18n, loadLocale } from '@/i18n'
import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  isAppLocale,
  primarySubtag,
  toBcp47,
  type AppLocale,
} from '@/i18n/locales'
import { localStore } from '@/shared/platform/storage'

/**
 * The server's enabled languages that the app translates, in the app's order. `null` means the
 * public configuration could not be loaded: every app language is offered (FR-003).
 */
export function resolveAvailableLocales(serverLanguages: readonly Language[] | null): AppLocale[] {
  if (serverLanguages === null) return [...APP_LOCALES]
  const codes = new Set(serverLanguages.map((language) => language.code.toLowerCase()))
  return APP_LOCALES.filter((locale) => codes.has(locale))
}

/** A language choice is shown only when there is something to choose (FR-060). */
export function showLanguageChoice(available: readonly AppLocale[]): boolean {
  return available.length > 1
}

/** Saving is per field: preferences are saved only in an active session (FR-038, FR-060). */
export function canSavePreferences(
  sessionState: SessionState | null,
  available: readonly AppLocale[],
): { locale: boolean; theme: boolean } {
  const active = sessionState === 'active'
  return { locale: active && available.length > 0, theme: active }
}

export interface PreSignInInput {
  remembered: string | null
  browserLanguages: readonly string[]
  serverDefault: string | null
  available: readonly AppLocale[]
}

/** Remembered, then browser, then server default, then English (FR-061). */
export function resolvePreSignInLocale(input: PreSignInInput): AppLocale {
  const { available } = input
  if (available.length === 0) return DEFAULT_LOCALE
  const offered = (code: string | null): code is AppLocale =>
    isAppLocale(code) && available.includes(code)
  if (offered(input.remembered)) return input.remembered
  for (const language of input.browserLanguages) {
    const match = available.find((locale) => primarySubtag(locale) === primarySubtag(language))
    if (match) return match
  }
  const serverDefault = input.serverDefault?.toLowerCase() ?? null
  if (offered(serverDefault)) return serverDefault
  return DEFAULT_LOCALE
}

export interface SignedInInput extends PreSignInInput {
  /** The profile language (`Identity.preferences.language`). */
  profile: string | null
  /** The language chosen on a sign-in screen during this visit, or null. */
  chosenOnSignIn: AppLocale | null
  current: AppLocale
}

/**
 * After sign-in the profile language applies, unless the user chose a language on the sign-in
 * screen during this visit, which is kept and saved. An untranslated profile language falls back
 * to the pre-sign-in order and is not overwritten (FR-061, data-model §4).
 */
export function resolveSignedInLocale(input: SignedInInput): {
  locale: AppLocale
  saveToProfile: boolean
} {
  const { available } = input
  if (available.length === 0) return { locale: DEFAULT_LOCALE, saveToProfile: false }
  if (input.chosenOnSignIn && available.includes(input.chosenOnSignIn)) {
    return { locale: input.chosenOnSignIn, saveToProfile: input.chosenOnSignIn !== input.profile }
  }
  const profile = input.profile?.toLowerCase() ?? null
  if (isAppLocale(profile) && available.includes(profile)) {
    return { locale: profile, saveToProfile: false }
  }
  return { locale: resolvePreSignInLocale(input), saveToProfile: false }
}

/** Switches the app to a language: messages, `<html lang>` and the remembered language. */
export async function applyLocale(locale: AppLocale): Promise<void> {
  await loadLocale(i18n, locale)
  i18n.global.locale.value = locale
  document.documentElement.lang = toBcp47(locale)
  localStore.set('mailcowui-ng.locale', locale)
}

/** The language remembered on this device, if any. */
export function rememberedLocale(): string | null {
  return localStore.get('mailcowui-ng.locale')
}

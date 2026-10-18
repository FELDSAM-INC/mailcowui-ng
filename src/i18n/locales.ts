// The app's locales (constitution IV 1.3.0, research R15): every language mailcow ships, the 33
// `data/web/lang/lang.<code>.json` files, identified by mailcow's codes so that server
// preferences map one to one. `toBcp47` converts them for Intl and `<html lang>` (FR-088).
export const APP_LOCALES = [
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
] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'en-gb'

/** The locales of the app's own new strings; every other locale falls back to en-gb. */
export const MESSAGE_LOCALES = ['en-gb', 'cs-cz', 'sk-sk'] as const satisfies readonly AppLocale[]

export type MessageLocale = (typeof MESSAGE_LOCALES)[number]

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value)
}

/** mailcow codes whose first part is not the ISO 639 language: Greek and Slovenian. */
const LANGUAGE_OF: Readonly<Record<string, string>> = { gr: 'el', si: 'sl' }

/** `en-gb` becomes `en-GB`, mailcow's `gr-gr` (Greek) `el-GR` and `si-si` (Slovenian) `sl-SI`. */
export function toBcp47(code: string): string {
  const [first = '', ...rest] = code.split('-')
  const language = first.toLowerCase()
  return [LANGUAGE_OF[language] ?? language, ...rest.map((part) => part.toUpperCase())].join('-')
}

/** The primary language subtag of a BCP 47 tag: `cs` for `cs-CZ`. */
export function primarySubtag(tag: string): string {
  return (tag.split('-')[0] ?? '').toLowerCase()
}

/**
 * The available locale for one browser language: the same language and region first (`pt-BR` is
 * `pt-br`), then the first available locale of the same language (`el` is `gr-gr`), or null.
 */
export function matchBrowserLanguage<L extends AppLocale>(
  browserLanguage: string,
  available: readonly L[],
): L | null {
  const wanted = browserLanguage.toLowerCase()
  const exact = available.find((locale) => toBcp47(locale).toLowerCase() === wanted)
  if (exact) return exact
  const language = primarySubtag(wanted)
  return available.find((locale) => primarySubtag(toBcp47(locale)) === language) ?? null
}

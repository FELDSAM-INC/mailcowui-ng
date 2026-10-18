// The app's locales (research R15). Identifiers are mailcow's language codes, so that server
// preferences map one to one; `toBcp47` converts them for Intl and `<html lang>` (FR-088).
export const APP_LOCALES = ['en-gb', 'cs-cz', 'sk-sk'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'en-gb'

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value)
}

/** `en-gb` becomes `en-GB`: language lower-case, region upper-case. */
export function toBcp47(code: string): string {
  const [language = '', ...rest] = code.split('-')
  return [language.toLowerCase(), ...rest.map((part) => part.toUpperCase())].join('-')
}

/** The primary language subtag: `cs` for `cs-cz` and `cs-CZ`. */
export function primarySubtag(code: string): string {
  return (code.split('-')[0] ?? '').toLowerCase()
}

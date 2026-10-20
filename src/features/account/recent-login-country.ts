export function recentLoginCountry(code: string | null, locale: string): string | null {
  if (!code) return null
  try {
    return new Intl.DisplayNames(locale, { type: 'region', fallback: 'code' }).of(code) ?? code
  } catch {
    return code
  }
}

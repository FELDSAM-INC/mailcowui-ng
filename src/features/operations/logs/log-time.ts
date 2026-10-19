// Times of log and scan history entries (FR-041): in the device's time zone, in the user's language,
// to the second, as the classic interface shows them (`toLocaleString` in `js/site/dashboard.js`).
import { toBcp47, type AppLocale } from '@/i18n/locales'

const formats = new Map<string, Intl.DateTimeFormat>()

export function formatLogTime(value: string, locale: AppLocale): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  let format = formats.get(locale)
  if (!format) {
    format = new Intl.DateTimeFormat(toBcp47(locale), { dateStyle: 'short', timeStyle: 'medium' })
    formats.set(locale, format)
  }
  return format.format(date)
}

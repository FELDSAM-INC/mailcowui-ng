// Locale formatting (FR-087, research R15): cached Intl formatters per locale, always in the
// device time zone (no `timeZone` option is ever passed).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { toBcp47, type AppLocale } from './locales'

export type DateValue = Date | string | number
export type DateStyle = 'dateTime' | 'date' | 'time'

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  dateTime: { dateStyle: 'medium', timeStyle: 'short' },
  date: { dateStyle: 'medium' },
  time: { timeStyle: 'short' },
}

const cache = new Map<string, unknown>()

function cached<T>(key: string, create: () => T): T {
  // The device time zone can change while the app runs; it is part of the key.
  const zoned = `${key}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  let value = cache.get(zoned) as T | undefined
  if (value === undefined) {
    value = create()
    cache.set(zoned, value)
  }
  return value
}

export function toDate(value: DateValue): Date {
  return value instanceof Date ? value : new Date(value)
}

export function formatDateTime(
  value: DateValue,
  locale: AppLocale,
  style: DateStyle = 'dateTime',
): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return cached(
    `date|${locale}|${style}`,
    () => new Intl.DateTimeFormat(toBcp47(locale), DATE_OPTIONS[style]),
  ).format(date)
}

export function formatNumber(
  value: number,
  locale: AppLocale,
  options: Intl.NumberFormatOptions = {},
): string {
  return cached(
    `number|${locale}|${JSON.stringify(options)}`,
    () => new Intl.NumberFormat(toBcp47(locale), options),
  ).format(value)
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
]

export function formatRelativeTime(
  value: DateValue,
  locale: AppLocale,
  now: number = Date.now(),
): string {
  const time = toDate(value).getTime()
  if (Number.isNaN(time)) return ''
  const seconds = Math.round((time - now) / 1000)
  const format = cached(
    `relative|${locale}`,
    () => new Intl.RelativeTimeFormat(toBcp47(locale), { numeric: 'auto' }),
  )
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size || unit === 'second') {
      return format.format(Math.round(seconds / size), unit)
    }
  }
  return format.format(0, 'second')
}

export function formatList(
  values: readonly string[],
  locale: AppLocale,
  type: Intl.ListFormatType = 'conjunction',
): string {
  return cached(
    `list|${locale}|${type}`,
    () => new Intl.ListFormat(toBcp47(locale), { style: 'long', type }),
  ).format(values)
}

/** The formatters bound to the language in use. */
export function useFormat() {
  const composer = useI18n({ useScope: 'global' })
  const current = computed(() => composer.locale.value as AppLocale)
  return {
    locale: current,
    dateTime: (value: DateValue, style?: DateStyle) => formatDateTime(value, current.value, style),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(value, current.value, options),
    relative: (value: DateValue, now?: number) => formatRelativeTime(value, current.value, now),
    list: (values: readonly string[], type?: Intl.ListFormatType) =>
      formatList(values, current.value, type),
  }
}

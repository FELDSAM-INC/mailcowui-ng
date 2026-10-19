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

/** A visible countdown: `1:05` for 65 seconds. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** A duration in words for announcements: "1 minute and 30 seconds" (FR-082). */
export function formatDuration(seconds: number, locale: AppLocale): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  const unit = (value: number, name: 'minute' | 'second') =>
    formatNumber(value, locale, { style: 'unit', unit: name, unitDisplay: 'long' })
  const parts: string[] = []
  if (minutes > 0) parts.push(unit(minutes, 'minute'))
  if (rest > 0 || minutes === 0) parts.push(unit(rest, 'second'))
  return formatList(parts, locale)
}

const BINARY_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] as const

/**
 * A size in binary units for the user's language (FR-016, UI 002 research D12). With `exact`, the
 * largest of MiB, GiB and TiB that represents the value exactly is used (quotas and limits:
 * 10,240 MiB is "10 GiB", 3,000 MiB stays "3,000 MiB"). Otherwise the largest unit in which the
 * value is at least 1, rounded to one decimal (storage).
 */
export function formatBytes(
  bytes: number,
  locale: AppLocale,
  options: { exact?: boolean } = {},
): string {
  if (options.exact && bytes > 0) {
    for (let power = 4; power >= 2; power -= 1) {
      const size = 1024 ** power
      if (bytes % size === 0) {
        return `${formatNumber(bytes / size, locale, { maximumFractionDigits: 0 })} ${BINARY_UNITS[power]}`
      }
    }
  }
  let power = 0
  while (power < BINARY_UNITS.length - 1 && Math.abs(bytes) >= 1024 ** (power + 1)) power += 1
  const value = bytes / 1024 ** power
  return `${formatNumber(value, locale, { maximumFractionDigits: power === 0 ? 0 : 1 })} ${BINARY_UNITS[power]}`
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
    duration: (seconds: number) => formatDuration(seconds, current.value),
    clock: formatClock,
    bytes: (value: number, options?: { exact?: boolean }) =>
      formatBytes(value, current.value, options),
  }
}

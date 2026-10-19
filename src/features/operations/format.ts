// Formats only the operations screens use (UI 011 FR-004, FR-007; constitution VIII: shared after a
// second use, and out of the shell's initial payload, research R22).
import { computed } from 'vue'

import { formatBytes, formatList, formatNumber, useFormat } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

/** UI 011 (FR-007): a rate in binary units per second; nothing for a rate that is not known yet. */
export function formatRate(bytesPerSecond: number | null, locale: AppLocale): string {
  if (bytesPerSecond === null || !Number.isFinite(bytesPerSecond)) return ''
  return `${formatBytes(bytesPerSecond, locale)}/s`
}

/**
 * UI 011 (FR-004): an uptime as days, hours and minutes in the language's words, from the largest
 * unit that is not zero (legacy shows `1D 2H 3M 4S`).
 */
export function formatUptime(seconds: number, locale: AppLocale): string {
  const total = Math.max(0, Math.floor(seconds))
  const parts: [number, 'day' | 'hour' | 'minute'][] = [
    [Math.floor(total / 86_400), 'day'],
    [Math.floor((total % 86_400) / 3_600), 'hour'],
    [Math.floor((total % 3_600) / 60), 'minute'],
  ]
  const first = parts.findIndex(([value]) => value > 0)
  const shown = first < 0 ? parts.slice(-1) : parts.slice(first)
  return formatList(
    shown.map(([value, unit]) =>
      formatNumber(value, locale, { style: 'unit', unit, unitDisplay: 'long' }),
    ),
    locale,
    'unit',
  )
}

/** The operations formats in the language in use. */
export function useOperationsFormat() {
  const fmt = useFormat()
  const locale = computed(() => fmt.locale.value)
  return {
    rate: (value: number | null) => formatRate(value, locale.value),
    uptime: (seconds: number) => formatUptime(seconds, locale.value),
  }
}

// Locale-aware number input (UI 006 research R18). `type="number"` parses by the browser's locale,
// not the app's, and hides why an entry is invalid, so number fields are text fields parsed here.
// The decimal separator is the locale's, and also `.` where `.` is not the locale's group
// separator: Czech and Slovak accept `6,5` and `6.5`, English only `6.5` (a comma there is a
// thousands separator, and guessing is unsafe for a reject threshold). Group separators, signs,
// exponents and more fraction digits than allowed are refused with a reason. Decimal values are
// returned in tenths (6.5 → 65), so comparisons are exact.
import { toBcp47 } from './locales'

export type NumberParseReason = 'empty' | 'notANumber' | 'tooManyDecimals'

export type DecimalParse =
  | { ok: true; empty: false; tenths: number; value: number }
  | { ok: true; empty: true; tenths: null; value: null }
  | { ok: false; reason: NumberParseReason }

export type IntegerParse =
  | { ok: true; empty: false; value: number }
  | { ok: true; empty: true; value: null }
  | { ok: false; reason: NumberParseReason }

const separators = new Map<string, { decimal: string; group: string }>()

/** The decimal and group separators of a locale, from `Intl.NumberFormat`. */
export function localeSeparators(locale: string): { decimal: string; group: string } {
  let entry = separators.get(locale)
  if (!entry) {
    const parts = new Intl.NumberFormat(toBcp47(locale)).formatToParts(12345.6)
    entry = {
      decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
      group: parts.find((part) => part.type === 'group')?.value ?? ',',
    }
    separators.set(locale, entry)
  }
  return entry
}

/**
 * A decimal with at most `maxFractionDigits` (default 1) fraction digits. With `optional`, an empty
 * entry is valid and gives null.
 */
export function parseLocaleDecimal(
  text: string,
  locale: string,
  options: { maxFractionDigits?: number; optional?: boolean } = {},
): DecimalParse {
  const maxFractionDigits = options.maxFractionDigits ?? 1
  const value = text.trim()
  if (value === '') {
    return options.optional
      ? { ok: true, empty: true, tenths: null, value: null }
      : { ok: false, reason: 'empty' }
  }
  const { decimal, group } = localeSeparators(locale)
  const accepted = new Set([decimal])
  if (group !== '.') accepted.add('.')
  let integer = ''
  let fraction: string | null = null
  for (const char of value) {
    if (char >= '0' && char <= '9') {
      if (fraction === null) integer += char
      else fraction += char
    } else if (accepted.has(char) && fraction === null) {
      fraction = ''
    } else {
      return { ok: false, reason: 'notANumber' }
    }
  }
  if (integer === '' && !fraction) return { ok: false, reason: 'notANumber' }
  if (fraction !== null && fraction === '') return { ok: false, reason: 'notANumber' }
  if (fraction !== null && fraction.replace(/0+$/, '').length > maxFractionDigits) {
    return { ok: false, reason: 'tooManyDecimals' }
  }
  const tenths = Number(integer || '0') * 10 + Number((fraction ?? '').padEnd(1, '0').slice(0, 1))
  const parsed = Number(`${integer || '0'}.${fraction || '0'}`)
  return { ok: true, empty: false, tenths, value: parsed }
}

/** A whole number of digits only; surrounding whitespace is ignored. */
export function parseLocaleInteger(
  text: string,
  options: { optional?: boolean } = {},
): IntegerParse {
  const value = text.trim()
  if (value === '') {
    return options.optional
      ? { ok: true, empty: true, value: null }
      : { ok: false, reason: 'empty' }
  }
  if (!/^[0-9]+$/.test(value)) return { ok: false, reason: 'notANumber' }
  return { ok: true, empty: false, value: Number(value) }
}

/** A value for editing: the locale's decimal separator, no grouping. */
export function formatEditableNumber(value: number, locale: string, fractionDigits = 1): string {
  return new Intl.NumberFormat(toBcp47(locale), {
    useGrouping: false,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export const toTenths = (value: number): number => Math.round(value * 10)
export const fromTenths = (tenths: number): number => tenths / 10

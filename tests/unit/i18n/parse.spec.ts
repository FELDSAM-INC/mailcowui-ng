// UI 006 (T016, research R18): locale decimals in tenths and whole numbers, with reason codes.
import { describe, expect, it } from 'vitest'

import {
  formatEditableNumber,
  fromTenths,
  localeSeparators,
  parseLocaleDecimal,
  parseLocaleInteger,
  toTenths,
} from '@/i18n/parse'

const tenths = (text: string, locale: string) => {
  const result = parseLocaleDecimal(text, locale)
  return result.ok ? result.tenths : result.reason
}

describe('parseLocaleDecimal', () => {
  it('reads the locale decimal separator and the dot in Czech and Slovak', () => {
    expect(tenths('6,5', 'cs-cz')).toBe(65)
    expect(tenths('6.5', 'cs-cz')).toBe(65)
    expect(tenths('6,5', 'sk-sk')).toBe(65)
    expect(tenths('6.5', 'sk-sk')).toBe(65)
  })

  it('reads only the dot in English, where a comma groups', () => {
    expect(tenths('6.5', 'en-gb')).toBe(65)
    expect(tenths('6,5', 'en-gb')).toBe('notANumber')
  })

  it('reads whole numbers, zero and surrounding whitespace', () => {
    expect(tenths('12', 'en-gb')).toBe(120)
    expect(tenths('0', 'en-gb')).toBe(0)
    expect(tenths(' 7.0 ', 'cs-cz')).toBe(70)
    expect(tenths('.5', 'en-gb')).toBe(5)
    const result = parseLocaleDecimal('12.5', 'en-gb')
    expect(result).toEqual({ ok: true, empty: false, tenths: 125, value: 12.5 })
  })

  it('refuses group separators, signs, exponents, extra digits and two separators', () => {
    expect(tenths('1 000', 'cs-cz')).toBe('notANumber')
    expect(tenths('1\u{A0}000', 'cs-cz')).toBe('notANumber')
    expect(tenths('1,000.5', 'en-gb')).toBe('notANumber')
    expect(tenths('-1', 'en-gb')).toBe('notANumber')
    expect(tenths('+1', 'en-gb')).toBe('notANumber')
    expect(tenths('1e3', 'en-gb')).toBe('notANumber')
    expect(tenths('6,55', 'cs-cz')).toBe('tooManyDecimals')
    expect(tenths('6.5.1', 'en-gb')).toBe('notANumber')
    expect(tenths('6,5.1', 'cs-cz')).toBe('notANumber')
    expect(tenths('5.', 'en-gb')).toBe('notANumber')
    expect(tenths('.', 'en-gb')).toBe('notANumber')
  })

  it('refuses an empty value unless it is optional', () => {
    expect(tenths('', 'en-gb')).toBe('empty')
    expect(tenths('  ', 'en-gb')).toBe('empty')
    expect(parseLocaleDecimal('', 'en-gb', { optional: true })).toEqual({
      ok: true,
      empty: true,
      tenths: null,
      value: null,
    })
  })

  it('accepts trailing zeros beyond the allowed digits', () => {
    expect(tenths('6.50', 'en-gb')).toBe(65)
  })

  it('derives the separators from Intl', () => {
    expect(localeSeparators('en-gb')).toEqual({ decimal: '.', group: ',' })
    expect(localeSeparators('cs-cz').decimal).toBe(',')
  })
})

describe('parseLocaleInteger', () => {
  it('accepts digits only, ignoring surrounding whitespace', () => {
    expect(parseLocaleInteger(' 2147483647 ')).toEqual({
      ok: true,
      empty: false,
      value: 2147483647,
    })
    expect(parseLocaleInteger('1.5')).toEqual({ ok: false, reason: 'notANumber' })
    expect(parseLocaleInteger('-3')).toEqual({ ok: false, reason: 'notANumber' })
    expect(parseLocaleInteger('1 000')).toEqual({ ok: false, reason: 'notANumber' })
    expect(parseLocaleInteger('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseLocaleInteger('', { optional: true })).toEqual({
      ok: true,
      empty: true,
      value: null,
    })
  })
})

describe('formatting for editing', () => {
  it('uses the locale separator without grouping', () => {
    expect(formatEditableNumber(1234.5, 'cs-cz')).toBe('1234,5')
    expect(formatEditableNumber(1234.5, 'en-gb')).toBe('1234.5')
    expect(formatEditableNumber(10, 'en-gb')).toBe('10')
    expect(toTenths(6.5)).toBe(65)
    expect(fromTenths(101)).toBe(10.1)
  })
})

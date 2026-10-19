// The rate limit view (T100, data-model §2 "Rate limit view", legacy form map screen 6): the
// read-only display "<value> <frame label>" in three locales or legacy's "Disabled", the limit in
// effect of a mailbox with its source, and the checks before sending from the capabilities.
import { afterEach, describe, expect, it } from 'vitest'

import type { RateLimit } from '@/api'
import { i18n, loadFeatureMessages } from '@/i18n'
import {
  effectiveText,
  formatLimit,
  limitMessages,
  validateLimit,
} from '@/features/rate-limits/rate-limit'

const CAPS = { min: 1, max: 2_147_483_647, frames: ['second', 'minute', 'hour', 'day'] as const }

function rateLimit(overrides: Partial<RateLimit> = {}): RateLimit {
  return {
    object: 'alice@example.org',
    kind: 'mailbox',
    limit: null,
    invalidStoredValue: null,
    effectiveLimit: null,
    effectiveSource: 'none',
    etag: '"r1"',
    ...overrides,
  }
}

afterEach(() => {
  i18n.global.locale.value = 'en-gb'
})

describe('formatLimit', () => {
  it('shows the value in the locale with the legacy frame label, or "Disabled"', async () => {
    expect(formatLimit({ value: 100, frame: 'hour' }, 'en-gb')).toBe('100 msgs / hour')
    expect(formatLimit({ value: 2_147_483_647, frame: 'day' }, 'en-gb')).toBe(
      '2,147,483,647 msgs / day',
    )
    expect(formatLimit(null, 'en-gb')).toBe('Disabled')
    expect(formatLimit(undefined, 'en-gb')).toBe('Disabled')
    await loadFeatureMessages('quarantine', i18n, 'cs-cz')
    i18n.global.locale.value = 'cs-cz'
    // The bundled snapshot is en-gb; the number follows the locale.
    expect(formatLimit({ value: 12_345, frame: 'minute' }, 'cs-cz')).toBe(
      `12${' '}345 msgs / minute`,
    )
    await loadFeatureMessages('quarantine', i18n, 'sk-sk')
    i18n.global.locale.value = 'sk-sk'
    expect(formatLimit({ value: 12_345, frame: 'second' }, 'sk-sk')).toBe(
      `12${' '}345 msgs / second`,
    )
  })
})

describe('effectiveText', () => {
  it('names the source of the limit in effect of a mailbox', () => {
    expect(
      effectiveText(
        rateLimit({ effectiveLimit: { value: 100, frame: 'hour' }, effectiveSource: 'domain' }),
        'en-gb',
      ),
    ).toBe('In effect: 100 msgs / hour (Domain)')
    expect(
      effectiveText(
        rateLimit({
          limit: { value: 10, frame: 'minute' },
          effectiveLimit: { value: 10, frame: 'minute' },
          effectiveSource: 'mailbox',
        }),
        'en-gb',
      ),
    ).toBe('In effect: 10 msgs / minute (Mailbox)')
    expect(effectiveText(rateLimit(), 'en-gb')).toBe('In effect: Disabled')
  })

  it('is null for domains and alias domains, and without the source', () => {
    expect(effectiveText(rateLimit({ kind: 'domain', object: 'example.org' }), 'en-gb')).toBeNull()
    expect(effectiveText(rateLimit({ kind: 'aliasDomain' }), 'en-gb')).toBeNull()
    expect(effectiveText(rateLimit({ effectiveSource: undefined }), 'en-gb')).toBeNull()
  })
})

describe('validateLimit', () => {
  it('accepts a whole number in range and a frame of the capabilities', () => {
    expect(validateLimit('10', 'minute', CAPS)).toEqual({
      ok: true,
      limit: { value: 10, frame: 'minute' },
    })
    expect(validateLimit(' 2147483647 ', 'day', CAPS)).toEqual({
      ok: true,
      limit: { value: 2_147_483_647, frame: 'day' },
    })
  })

  it('reads an empty value as "no limit" (legacy removes the limit)', () => {
    expect(validateLimit('', 'hour', CAPS)).toEqual({ ok: true, limit: null })
    expect(validateLimit('   ', 'bogus', CAPS)).toEqual({ ok: true, limit: null })
  })

  it('refuses values out of range, text, and frames the server does not offer', () => {
    expect(validateLimit('0', 'hour', CAPS)).toEqual({
      ok: false,
      errors: { value: { code: 'outOfRange', min: 1, max: 2_147_483_647 } },
    })
    expect(validateLimit('2147483648', 'hour', CAPS)).toEqual({
      ok: false,
      errors: { value: { code: 'outOfRange', min: 1, max: 2_147_483_647 } },
    })
    expect(validateLimit('1.5', 'hour', CAPS)).toEqual({
      ok: false,
      errors: { value: { code: 'notANumber', text: '1.5' } },
    })
    expect(validateLimit('10', 'week', CAPS)).toEqual({
      ok: false,
      errors: { frame: { code: 'notInList' } },
    })
    expect(validateLimit('10', 'second', { ...CAPS, frames: ['hour', 'day'] })).toEqual({
      ok: false,
      errors: { frame: { code: 'notInList' } },
    })
  })

  it('turns the errors into legacy messages and the range in the locale', () => {
    const result = validateLimit('0', 'week', CAPS)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(limitMessages(result.errors, 'en-gb')).toEqual({
      value: ['Enter a value from 1 to 2,147,483,647.'],
      frame: ['Rate limit time frame is incorrect'],
    })
    const text = validateLimit('ten', 'hour', CAPS)
    if (text.ok) throw new Error('expected an error')
    expect(limitMessages(text.errors, 'en-gb')).toEqual({ value: ['Value ten is not numeric'] })
  })
})

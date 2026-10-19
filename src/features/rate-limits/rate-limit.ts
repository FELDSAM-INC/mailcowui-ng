// The rate limit view (data-model §2 "Rate limit view", legacy form map screen 6): the read-only
// display "<value> <frame label>" with the locale's number format and legacy's `ratelimit.*` unit
// labels, or legacy's "Disabled"; a mailbox's limit in effect with its source; and the checks of
// the legacy form before sending (an empty value removes the limit, D2), with the range and the
// frames from the quarantine capabilities, never hard-coded.
import type { QuarantineCapabilities, RateLimit, RateLimitValue } from '@/api'
import { i18n, lt, text, type LegacyKey } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import { parseLocaleInteger } from '@/i18n/parse'
import { neutralise } from '@/shared/security/plain-text'

export type RateLimitFrame = RateLimitValue['frame']
export type RateLimitCapabilities = QuarantineCapabilities['rateLimit']

/** The frame options of `templates/mailbox/rl-frame.twig`. */
export const FRAME_KEYS: Record<RateLimitFrame, LegacyKey> = {
  second: 'ratelimit.second',
  minute: 'ratelimit.minute',
  hour: 'ratelimit.hour',
  day: 'ratelimit.day',
}

/** "100 msgs / hour", or legacy's "Disabled" without a limit. */
export function formatLimit(limit: RateLimitValue | null | undefined, locale: AppLocale): string {
  if (!limit) return lt('ratelimit.disabled')
  return i18n.global.t('domains.values.rateLimit', {
    value: formatNumber(limit.value, locale),
    frame: lt(FRAME_KEYS[limit.frame]),
  })
}

/**
 * A mailbox's limit in effect and where it comes from ("In effect: 100 msgs / hour (Domain)"), or
 * "In effect: Disabled" when neither the mailbox nor its domain has one; null for other objects.
 */
export function effectiveText(rateLimit: RateLimit, locale: AppLocale): string | null {
  if (rateLimit.kind !== 'mailbox' || !rateLimit.effectiveSource) return null
  if (rateLimit.effectiveSource === 'none' || !rateLimit.effectiveLimit) {
    return i18n.global.t('rateLimits.effective.withoutSource', {
      limit: lt('ratelimit.disabled'),
    })
  }
  return i18n.global.t('rateLimits.effective.title', {
    limit: formatLimit(rateLimit.effectiveLimit, locale),
    source: text(`enums.rateLimitEffectiveSource.${rateLimit.effectiveSource}`),
  })
}

/** An API string as inert text: control and bidi characters become visible code points. */
export function inertText(value: string): string {
  return neutralise(value, { multiline: false })
    .map((segment) => (segment.kind === 'text' ? segment.value : segment.codePoint))
    .join('')
}

/** A stored value in an invalid format (D17), with its text as inert text. */
export function invalidStoredText(stored: string): string {
  return i18n.global.t('rateLimits.invalidStoredValue', { value: inertText(stored) })
}

export type LimitError =
  | { code: 'outOfRange'; min: number; max: number }
  | { code: 'notANumber'; text: string }
  | { code: 'notInList' }

export interface LimitErrors {
  value?: LimitError
  frame?: LimitError
}

export type LimitCheck =
  { ok: true; limit: RateLimitValue | null } | { ok: false; errors: LimitErrors }

/** The legacy form's value and frame: empty means no limit; otherwise a whole number in range. */
export function validateLimit(
  value: string,
  frame: string,
  caps: { min: number; max: number; frames: readonly string[] },
): LimitCheck {
  const parsed = parseLocaleInteger(value, { optional: true })
  if (parsed.ok && parsed.empty) return { ok: true, limit: null }
  const errors: LimitErrors = {}
  if (!parsed.ok) errors.value = { code: 'notANumber', text: value.trim() }
  else if (parsed.value < caps.min || parsed.value > caps.max) {
    errors.value = { code: 'outOfRange', min: caps.min, max: caps.max }
  }
  if (!caps.frames.includes(frame)) errors.frame = { code: 'notInList' }
  if (errors.value || errors.frame || !parsed.ok) return { ok: false, errors }
  return { ok: true, limit: { value: parsed.value, frame: frame as RateLimitFrame } }
}

function message(error: LimitError, locale: AppLocale): string {
  switch (error.code) {
    case 'outOfRange':
      return i18n.global.t('validation.outOfRange', {
        min: formatNumber(error.min, locale),
        max: formatNumber(error.max, locale),
      })
    case 'notANumber':
      return lt('danger.object_is_not_numeric', error.text)
    case 'notInList':
      // Legacy's `danger.rl_timeframe`, through LEGACY_TEXTS.
      return text('rateLimits.form.errors.frame.notInList')
  }
}

/** The messages of the client checks, by field. */
export function limitMessages(errors: LimitErrors, locale: AppLocale): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  if (errors.value) result.value = [message(errors.value, locale)]
  if (errors.frame) result.frame = [message(errors.frame, locale)]
  return result
}

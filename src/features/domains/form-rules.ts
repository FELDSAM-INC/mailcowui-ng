// Client-side rules shared by the create form, the domain sections and the template form
// (data-model §6): limits, quotas and their order, tags, the rate limit and DKIM. Each rule gives
// a translation key with display parameters; API errors are always shown as well (FR-032).
import type { DomainCapabilities } from '@/api'
import type { TextRef } from '@/i18n'
import {
  DKIM_SELECTOR_MAX_LENGTH,
  DOMAIN_LIMIT_MAX,
  DOMAIN_LIMIT_MIN,
  RATE_LIMIT_MAX,
  RATE_LIMIT_MIN,
} from '@/shared/validation/limits'

import { exceedsTagLimit } from '@/shared/utils/tag-set'

export interface ClientError {
  /** A new string's key, or one of mailcow's own messages (`legacy('danger.domain_invalid')`). */
  key: TextRef
  /** Display values; `field` holds the message key of another field's label (`text()`). */
  params?: Record<string, string>
}

export type ClientErrors = Record<string, ClientError[]>

export interface RuleFormat {
  quota(bytes: number): string
  count(value: number): string
}

export function add(errors: ClientErrors, path: string, error: ClientError): void {
  ;(errors[path] ??= []).push(error)
}

/** A whole number from `min` to `max`, or the error for it. */
export function checkWhole(
  errors: ClientErrors,
  path: string,
  value: string,
  range: { min: number; max: number },
  format: RuleFormat,
): number | null {
  const text = value.trim()
  const number = /^\d+$/.test(text) ? Number(text) : Number.NaN
  if (!Number.isSafeInteger(number) || number < range.min || number > range.max) {
    add(errors, path, {
      key: 'validation.outOfRange',
      params: { min: format.count(range.min), max: format.count(range.max) },
    })
    return null
  }
  return number
}

export function checkLimit(errors: ClientErrors, path: string, value: string, format: RuleFormat) {
  return checkWhole(errors, path, value, { min: DOMAIN_LIMIT_MIN, max: DOMAIN_LIMIT_MAX }, format)
}

/** The maximum mailbox quota ≤ the domain quota (`mustNotExceed`). */
export function checkQuotaOrder(
  errors: ClientErrors,
  quotas: { maxMailboxQuota: number | null; domainQuota: number | null },
  format: RuleFormat,
): void {
  const { maxMailboxQuota, domainQuota } = quotas
  if (maxMailboxQuota !== null && domainQuota !== null && maxMailboxQuota > domainQuota) {
    add(errors, 'maxMailboxQuota', {
      key: 'validation.mustNotExceed',
      params: { field: 'domains.fields.domainQuota', value: format.quota(domainQuota) },
    })
  }
}

export function checkTags(
  errors: ClientErrors,
  tags: readonly string[],
  stored: readonly string[],
  limit: number,
  format: RuleFormat,
): void {
  if (exceedsTagLimit(tags, stored, limit)) {
    add(errors, 'tags', { key: 'validation.tooMany', params: { max: format.count(limit) } })
  }
}

export function checkRateLimit(
  errors: ClientErrors,
  rateLimit: { enabled: boolean; value: string },
  format: RuleFormat,
): number | null {
  if (!rateLimit.enabled) return null
  return checkWhole(
    errors,
    'rateLimit.value',
    rateLimit.value,
    { min: RATE_LIMIT_MIN, max: RATE_LIMIT_MAX },
    format,
  )
}

const SELECTOR = /^[A-Za-z0-9._-]*$/

export function checkDkim(
  errors: ClientErrors,
  dkim: { generate: boolean; selector: string; keySize: number },
  capabilities: Pick<DomainCapabilities, 'dkim'>,
  format: RuleFormat,
): void {
  if (!dkim.generate) return
  const selector = dkim.selector.trim()
  if (!SELECTOR.test(selector))
    add(errors, 'dkimSelector', { key: 'validation.format.dkimSelector' })
  else if (selector.length > DKIM_SELECTOR_MAX_LENGTH) {
    add(errors, 'dkimSelector', {
      key: 'validation.tooLong',
      params: { max: format.count(DKIM_SELECTOR_MAX_LENGTH) },
    })
  }
  const allowed = capabilities.dkim?.allowedKeySizes ?? []
  if (allowed.length > 0 && !allowed.includes(dkim.keySize)) {
    add(errors, 'dkimKeySize', {
      key: 'validation.notInList',
      params: { allowed: allowed.map((size) => format.count(size)).join(', ') },
    })
  }
}

export function checkLength(
  errors: ClientErrors,
  path: string,
  value: string,
  max: number,
  format: RuleFormat,
): void {
  if (value.length > max)
    add(errors, path, { key: 'validation.tooLong', params: { max: format.count(max) } })
}

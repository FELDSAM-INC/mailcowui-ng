// The quota in MiB with "0 = ∞", as the classic forms enter it (docs/conventions.md "Follow the
// legacy form"). The create form always sends a quota, prefilled from the chosen template and
// capped at the domain's largest quota for a new mailbox (owner decision 2026-10-18); a domain
// without quota left fixes it at 0, as legacy disables the field. Before sending, a value above the
// maximum gets legacy's `danger.mailbox_quota_exceeded`, and 0 without the unlimited quota
// permission `danger.unlimited_quota_acl`.
import { legacy } from '@/i18n'
import { add, type ClientErrors } from '@/shared/validation/client-errors'

export const MIB = 1_048_576

/** Bytes as the whole MiB the field shows. */
export const quotaMib = (bytes: number) => String(Math.floor(bytes / MIB))

/** A whole, non-negative number of MiB, or null. */
export function parseQuotaMib(text: string): number | null {
  const value = text.trim()
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

/**
 * The create form's quota in MiB: the template's, capped at the domain's largest quota for a new
 * mailbox (an unlimited template gets the largest), or 0 when the domain has no quota left. Before
 * a domain is chosen, the template's.
 */
export function prefillQuotaMib(templateQuota: number, maxNewQuota: number | null): number {
  const template = Math.floor(templateQuota / MIB)
  if (maxNewQuota === null) return template
  const max = Math.floor(maxNewQuota / MIB)
  if (max === 0) return 0
  if (template === 0 || template > max) return max
  return template
}

export interface QuotaRules {
  /** The largest quota in bytes (`maxNewMailboxQuota`, `largestAllowedQuota`); null for none. */
  max: number | null
  /** Whether 0 (unlimited) may be entered. */
  unlimitedAllowed: boolean
  /** The stored quota in bytes, which is always accepted again. */
  current?: number
}

/** The quota in bytes, or null with the error added. */
export function checkQuota(
  errors: ClientErrors,
  path: string,
  text: string,
  rules: QuotaRules,
): number | null {
  const mib = parseQuotaMib(text)
  if (mib === null) {
    add(errors, path, { key: 'validation.invalid' })
    return null
  }
  const bytes = mib * MIB
  if (bytes === rules.current) return bytes
  if (mib === 0) {
    if (!rules.unlimitedAllowed) {
      add(errors, path, { key: legacy('danger.unlimited_quota_acl') })
      return null
    }
    return 0
  }
  if (rules.max !== null && bytes > rules.max) {
    add(errors, path, { key: legacy('danger.mailbox_quota_exceeded', Math.floor(rules.max / MIB)) })
    return null
  }
  return bytes
}

// Client-side rules of the mailbox forms (research R18, data-model §6). A rule gives mailcow's own
// message where the classic interface has one (`danger.mailbox_invalid`,
// `danger.password_complexity`, `danger.password_mismatch`, `danger.template_name_invalid`), and
// otherwise a new string. Checks that need a capability are skipped without one: the API decides
// (research R16). Values stored by legacy beyond the limits stay as they are.
import { legacy } from '@/i18n'
import { add, type ClientErrors } from '@/shared/validation/client-errors'
import {
  MAILBOX_ADDRESS_MAX,
  MAILBOX_DISPLAY_NAME_MAX,
  MAILBOX_PASSWORD_MAX,
  MAILBOX_RATE_LIMIT_MAX,
  MAILBOX_RATE_LIMIT_MIN,
  MAILBOX_RECOVERY_EMAIL_MAX,
  MAILBOX_TEMPLATE_NAME_MAX,
} from '@/shared/validation/limits'

const ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
const LOCAL_PART = new RegExp(`^${ATOM}(\\.${ATOM})*$`)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOCAL_PART_MAX = 64

const tooLong = (max: number) => ({ key: 'validation.tooLong', params: { max: String(max) } })

/** Trimmed and lower-cased, as the API normalises it. */
export function normaliseLocalPart(raw: string): string {
  return raw.trim().toLowerCase()
}

/** The local part rules of `MailboxCreateRequest.localPart`; returns the normalised value. */
export function checkLocalPart(
  errors: ClientErrors,
  path: string,
  raw: string,
  domain: string | null,
): string {
  const localPart = normaliseLocalPart(raw)
  if (localPart === '') add(errors, path, { key: 'validation.required' })
  else if (
    localPart.length > LOCAL_PART_MAX ||
    !LOCAL_PART.test(localPart) ||
    (domain !== null && `${localPart}@${domain}`.length > MAILBOX_ADDRESS_MAX)
  ) {
    add(errors, path, { key: legacy('danger.mailbox_invalid') })
  }
  return localPart
}

/** The rename's new local part: the same rules, and not the current one ignoring letter case. */
export function checkRenameLocalPart(
  errors: ClientErrors,
  path: string,
  raw: string,
  current: string,
  domain: string,
): string {
  const localPart = checkLocalPart(errors, path, raw, domain)
  if (!errors[path] && localPart === current.toLowerCase()) {
    add(errors, path, { key: 'validation.unchanged' })
  }
  return localPart
}

/** The password and its repeat, as legacy's `password_check` does before sending. */
export function checkPasswordPair(
  errors: ClientErrors,
  password: string,
  repeat: string,
  options: { required: boolean },
): void {
  if (password === '' && repeat === '') {
    if (options.required) add(errors, 'password', { key: legacy('danger.password_complexity') })
    return
  }
  if (password.length > MAILBOX_PASSWORD_MAX) {
    add(errors, 'password', tooLong(MAILBOX_PASSWORD_MAX))
    return
  }
  if (password !== repeat) add(errors, 'password2', { key: legacy('danger.password_mismatch') })
}

export function checkRecoveryEmail(errors: ClientErrors, path: string, raw: string): void {
  const value = raw.trim()
  if (value === '') return
  if (value.length > MAILBOX_RECOVERY_EMAIL_MAX)
    add(errors, path, tooLong(MAILBOX_RECOVERY_EMAIL_MAX))
  else if (!EMAIL.test(value)) add(errors, path, { key: 'validation.format.email' })
}

export function checkDisplayName(errors: ClientErrors, path: string, raw: string): void {
  if (raw.length > MAILBOX_DISPLAY_NAME_MAX) add(errors, path, tooLong(MAILBOX_DISPLAY_NAME_MAX))
}

/** No rate limit (empty), or a whole number from 1 to 2,147,483,647. */
export function checkRateLimit(errors: ClientErrors, path: string, raw: string): number | null {
  const text = raw.trim()
  if (text === '') return null
  const value = /^\d+$/.test(text) ? Number(text) : Number.NaN
  if (
    !Number.isSafeInteger(value) ||
    value < MAILBOX_RATE_LIMIT_MIN ||
    value > MAILBOX_RATE_LIMIT_MAX
  ) {
    add(errors, path, {
      key: 'validation.outOfRange',
      params: { min: String(MAILBOX_RATE_LIMIT_MIN), max: String(MAILBOX_RATE_LIMIT_MAX) },
    })
    return null
  }
  return value
}

/** The template name: trimmed, 1–255 characters; uniqueness is the API's (FR-060). */
export function checkTemplateName(errors: ClientErrors, path: string, raw: string): string {
  const name = raw.trim()
  if (name === '') add(errors, path, { key: legacy('danger.template_name_invalid') })
  else if (name.length > MAILBOX_TEMPLATE_NAME_MAX)
    add(errors, path, tooLong(MAILBOX_TEMPLATE_NAME_MAX))
  return name
}

/** One row of the custom attributes table; `storedName` is the name it was read with. */
export interface AttributeRow {
  id: number
  name: string
  value: string
  storedName?: string
}

/** The custom attribute limits of `MailboxCapabilities`. */
interface AttributeLimits {
  customAttributeLimit: number
  customAttributeNameMaxLength: number
  customAttributeValueMaxLength: number
}

/**
 * Names without whitespace, unique (case-sensitive, as object keys are), within the capability
 * lengths; values within theirs; the count within the limit when it grows. A row that still has
 * its stored name and value is not checked, as the API checks only what is sent.
 */
export function checkAttributes(
  errors: ClientErrors,
  rows: readonly AttributeRow[],
  limits: AttributeLimits | undefined,
  stored: Readonly<Record<string, string>>,
): void {
  const seen = new Set<string>()
  for (const row of rows) {
    const path = `attributes.${row.id}`
    const name = row.name.trim()
    const unchanged = row.storedName === name && stored[name] === row.value
    if (name === '') add(errors, `${path}.name`, { key: 'validation.required' })
    else if (seen.has(name)) add(errors, `${path}.name`, { key: 'mailboxes.attributes.duplicate' })
    else if (!unchanged && /\s/.test(name)) {
      add(errors, `${path}.name`, { key: 'validation.format.attributeName' })
    } else if (!unchanged && limits && name.length > limits.customAttributeNameMaxLength) {
      add(errors, `${path}.name`, tooLong(limits.customAttributeNameMaxLength))
    }
    seen.add(name)
    if (!unchanged && limits && row.value.length > limits.customAttributeValueMaxLength) {
      add(errors, `${path}.value`, tooLong(limits.customAttributeValueMaxLength))
    }
  }
  const count = Object.keys(stored).length
  if (limits && rows.length > limits.customAttributeLimit && rows.length > count) {
    add(errors, 'attributes', {
      key: 'validation.tooMany',
      params: { max: String(limits.customAttributeLimit) },
    })
  }
}

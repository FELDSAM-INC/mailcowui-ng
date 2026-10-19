// The rules of the add mailbox form (US2, FR-019 to FR-030 under the forms rule): the local part,
// the domain, the password and its repeat (unless pre-hashed, the policy is the server's to check,
// as in legacy), the quota in MiB against the domain's largest new mailbox quota, and the rate
// limit. The field IDs of the error summary.
import { legacy } from '@/i18n'
import { add, type ClientErrors } from '@/shared/validation/client-errors'

import type { CheckedValues, MailboxValues } from './form-values'
import { checkQuota } from './quota'
import { templateFieldId } from './templates/template-form'
import { checkDisplayName, checkLocalPart, checkPasswordPair, checkRateLimit } from './validation'

export interface CreateFields {
  localPart: string
  displayName: string
  domain: string | null
  password: string
  password2: string
}

export interface CreateRules {
  /** The domain's largest new mailbox quota in bytes, or null before a domain is chosen. */
  maxQuota: number | null
  unlimitedAllowed: boolean
}

/** The checked values, or null with the errors added. */
export function checkCreate(
  errors: ClientErrors,
  fields: CreateFields,
  values: MailboxValues,
  rules: CreateRules,
): CheckedValues | null {
  checkLocalPart(errors, 'localPart', fields.localPart, fields.domain)
  checkDisplayName(errors, 'displayName', fields.displayName)
  if (!fields.domain) add(errors, 'domain', { key: legacy('add.select_domain') })
  checkPasswordPair(errors, fields.password, fields.password2, { required: true })
  const quota = checkQuota(errors, 'quota', values.quota, {
    max: rules.maxQuota === 0 ? null : rules.maxQuota,
    unlimitedAllowed: rules.unlimitedAllowed || rules.maxQuota === 0,
  })
  const value = checkRateLimit(errors, 'rateLimit', values.rateLimitValue)
  if (Object.keys(errors).length > 0 || quota === null) return null
  return { quota, rateLimit: value === null ? null : { value, frame: values.rateLimitFrame } }
}

const OWN_FIELDS = new Set([
  'localPart',
  'displayName',
  'domain',
  'templateId',
  'password',
  'password2',
])

export function createFieldId(idPrefix: string, path: string): string {
  const field = path.split('.')[0] ?? path
  if (field === 'templateId') return `${idPrefix}-template`
  return OWN_FIELDS.has(field) ? `${idPrefix}-${field}` : templateFieldId(idPrefix, path)
}

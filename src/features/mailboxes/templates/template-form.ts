// The template form's rules (FR-059, FR-060): the name required, trimmed and at most 255
// characters (legacy's "Template name invalid"); the quota in MiB with "0 = ∞" and no maximum; the
// rate limit empty for none or a whole number. The edited members and the field IDs of the error
// summary.
import type { ClientErrors } from '@/shared/validation/client-errors'

import type { CheckedValues, MailboxValues } from '../form-values'
import { checkQuota } from '../quota'
import type { MailboxTemplate } from '../types'
import { checkRateLimit, checkTemplateName } from '../validation'

/** The members the template form edits, in its order, for the outdated notice. */
export const TEMPLATE_FIELDS = [
  'name',
  'tags',
  'quota',
  'taggedMailHandling',
  'quarantineNotification',
  'quarantineCategory',
  'tlsEnforceInbound',
  'tlsEnforceOutbound',
  'protocolAccess',
  'userPermissions',
  'rateLimit',
  'status',
  'forcePasswordChange',
  'forceSecondFactorSetup',
  'webmailRedirect',
] as const satisfies readonly (keyof MailboxTemplate)[]

export type TemplateField = (typeof TEMPLATE_FIELDS)[number]

/** The checked values, or null with the errors added. */
export function checkTemplate(
  errors: ClientErrors,
  name: string,
  values: MailboxValues,
): CheckedValues | null {
  checkTemplateName(errors, 'name', name)
  const quota = checkQuota(errors, 'quota', values.quota, { max: null, unlimitedAllowed: true })
  const value = checkRateLimit(errors, 'rateLimit', values.rateLimitValue)
  if (Object.keys(errors).length > 0 || quota === null) return null
  return { quota, rateLimit: value === null ? null : { value, frame: values.rateLimitFrame } }
}

const FIELD_IDS: Readonly<Record<string, string>> = {
  protocolAccess: 'protocols',
  userPermissions: 'permissions',
  rateLimit: 'rateLimit-value',
  taggedMailHandling: 'taggedMail-subfolder',
  quarantineNotification: 'quarantineNotification-never',
  quarantineCategory: 'quarantineCategory-rejected',
  tlsEnforceInbound: 'tls-inbound',
  tlsEnforceOutbound: 'tls-outbound',
}

/** The control of a problem's path, for the error summary's links. */
export function templateFieldId(idPrefix: string, path: string): string {
  const field = path.split('.')[0] ?? path
  return `${idPrefix}-${FIELD_IDS[field] ?? field}`
}

// Problems of the mailbox forms (research R17, FR-068, SC-005, the legacy form map's messages): each
// is shown with the legacy `danger.*` message of the same meaning on its field, its placeholders
// filled from the problem (the address in use, the count and limit, the maximum in MiB); what has
// no legacy equivalent stays with the generic `problem.*` and `validation.*` texts. The English
// `title` and `detail` are never used.
import { ApiProblem, type FieldViolation, type MailboxRenameStep } from '@/api'
import { legacy, type LegacyKey, type TextRef } from '@/i18n'
import { add, type ClientErrors } from '@/shared/validation/client-errors'

import { FLAG_LABEL_KEYS } from './acl'

const MIB = 1_048_576

export interface MailboxProblemView {
  /** Legacy messages on fields, by the problem's dot path. */
  fields: ClientErrors
  /** A legacy message for the whole form, replacing the generic one. */
  form: TextRef | null
  /** What is left for the generic texts: the remaining field errors, or the whole problem. */
  rest: ApiProblem | null
}

export interface MailboxProblemContext {
  /** The field of the local part (`newLocalPart` on the rename form). */
  localPartField?: string
  /** The template name as typed, for `danger.template_exists`. */
  templateName?: string
}

const HOLDER_KEYS: Record<string, LegacyKey> = {
  mailbox: 'danger.is_alias_or_mailbox',
  resource: 'danger.is_alias_or_mailbox',
  alias: 'danger.is_alias',
  temporaryAlias: 'danger.is_spam_alias',
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const num = (value: unknown) => (typeof value === 'number' ? value : 0)

/** The legacy message of one violation, or null when legacy has none. */
function violationText(path: string, violation: FieldViolation): TextRef | null {
  const code = String(violation.code)
  const params = (violation.params ?? {}) as Record<string, unknown>
  if ((path === 'localPart' || path === 'newLocalPart') && code === 'invalidFormat') {
    return legacy('danger.mailbox_invalid')
  }
  if (path === 'password' && (code === 'tooShort' || code === 'missingCharacterClass')) {
    return legacy('danger.password_complexity')
  }
  if (path === 'quota' && code === 'outOfRange') {
    const max = Math.floor(num(params.max) / MIB)
    return params.limit === 'domainQuotaLeft'
      ? legacy('danger.mailbox_quota_left_exceeded', max)
      : legacy('danger.mailbox_quota_exceeded', max)
  }
  if (path === 'name' && code === 'required') return legacy('danger.template_name_invalid')
  return null
}

export function mailboxProblem(
  problem: ApiProblem,
  context: MailboxProblemContext = {},
): MailboxProblemView {
  const fields: ClientErrors = {}
  const ext = problem.extensions
  if (problem.is('address-in-use')) {
    const key = HOLDER_KEYS[str(ext.holder)] ?? 'danger.is_alias_or_mailbox'
    add(fields, context.localPartField ?? 'localPart', { key: legacy(key, str(ext.address)) })
    return { fields, form: null, rest: null }
  }
  if (problem.is('mailbox-limit-reached')) {
    return {
      fields,
      form: legacy('danger.max_mailbox_exceeded', num(ext.count), num(ext.limit)),
      rest: null,
    }
  }
  if (problem.is('mailbox-template-name-exists')) {
    add(fields, 'name', { key: legacy('danger.template_exists', context.templateName ?? '') })
    return { fields, form: null, rest: null }
  }
  if (problem.is('attribute-not-permitted')) {
    const flags = (ext.requiredFlags ?? {}) as Record<string, string>
    const attributes = Array.isArray(ext.attributes) ? ext.attributes.map(String) : []
    for (const path of attributes) {
      const flag = flags[path]
      if (path === 'quota' && flag === 'unlimitedQuota') {
        add(fields, path, { key: legacy('danger.unlimited_quota_acl') })
        continue
      }
      add(fields, path, { key: legacy('acl.prohibited') })
      const label = flag ? FLAG_LABEL_KEYS[flag as keyof typeof FLAG_LABEL_KEYS] : undefined
      if (label) add(fields, path, { key: legacy(label) })
    }
    return { fields, form: null, rest: attributes.length > 0 ? null : problem }
  }
  if (problem.fieldErrors.size > 0) {
    const remaining = new Map<string, FieldViolation[]>()
    for (const [path, violations] of problem.fieldErrors) {
      const left: FieldViolation[] = []
      for (const violation of violations) {
        if (path === 'tags' && String(violation.code) === 'tooMany') {
          const max = (violation.params as Record<string, unknown> | undefined)?.max
          add(fields, path, {
            key: 'mailboxes.problem.tagLimit',
            params: { max: typeof max === 'number' ? String(max) : '' },
          })
          continue
        }
        const text = violationText(path, violation)
        if (!text) left.push(violation)
        else if (!fields[path]?.some((item) => JSON.stringify(item.key) === JSON.stringify(text))) {
          add(fields, path, { key: text })
        }
      }
      if (left.length > 0) remaining.set(path, left)
    }
    const rest =
      remaining.size > 0
        ? ApiProblem.fromParts({
            kind: problem.kind,
            type: problem.type ?? undefined,
            status: problem.status ?? undefined,
            requestId: problem.requestId ?? undefined,
            extensions: { ...problem.extensions },
            fieldErrors: remaining,
          })
        : null
    return { fields, form: null, rest }
  }
  return { fields, form: null, rest: problem }
}

/** The persistent report of a rename that is incomplete or whose outcome is unknown (FR-052). */
export interface RenameReportView {
  kind: 'incomplete' | 'unknown'
  previousAddress: string
  newAddress: string
  steps: MailboxRenameStep[]
  unknownStep: string | null
}

export function renameReport(
  problem: ApiProblem,
  previousAddress: string,
  newAddress: string,
): RenameReportView | null {
  const ext = problem.extensions
  const steps = Array.isArray(ext.steps) ? (ext.steps as MailboxRenameStep[]) : []
  if (problem.is('mailbox-rename-incomplete')) {
    return {
      kind: 'incomplete',
      previousAddress: str(ext.previousAddress) || previousAddress,
      newAddress: str(ext.newAddress) || newAddress,
      steps,
      unknownStep: null,
    }
  }
  if (problem.is('outcome-unknown')) {
    return {
      kind: 'unknown',
      previousAddress,
      newAddress,
      steps,
      unknownStep: str(ext.step) || null,
    }
  }
  return null
}

// Field messages of the sync-job forms (UI 008 research R13, plan legacy form map part 2). The
// rules API 008 adds read as their own messages, with the refused option or token; an address
// that cannot receive synced mail names its kind; a missing owner reads legacy's "No user
// defined". Every other code is left to UI 001's generic `validation.*` messages (null here).
import { useI18n } from 'vue-i18n'

import type { FieldViolation } from '@/api'
import { resolveText, text, type TextRef } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'

export interface FieldMessage {
  key: TextRef
  params?: Record<string, string>
  /** Parameters that are themselves message keys, translated before use. */
  keyParams?: Record<string, string>
}

const KINDS = ['resource', 'alias', 'aliasDomainAddress']

export function fieldMessage(field: string, violation: FieldViolation): FieldMessage | null {
  const code = String(violation.code)
  const params = (violation.params ?? {}) as Record<string, unknown>
  const name = field.split('.')[0]
  if (code === 'invalidFormat' && params.format === 'hostName') {
    return { key: 'validation.format.hostName' }
  }
  if (code === 'invalidRegex') return { key: 'validation.invalidRegex' }
  if (code === 'customParamsNotPermitted') return { key: 'validation.customParamsNotPermitted' }
  if (code === 'optionNotAllowed') {
    return {
      key: 'validation.optionNotAllowed',
      params: { option: typeof params.option === 'string' ? params.option : '' },
    }
  }
  if (code === 'optionContainsSpace') {
    return {
      key: 'validation.optionContainsSpace',
      params: { token: typeof params.token === 'string' ? params.token : '' },
    }
  }
  if (name === 'mailbox' && code === 'notEligible') {
    const kind = typeof params.kind === 'string' && KINDS.includes(params.kind) ? params.kind : null
    return kind
      ? {
          key: 'syncJobs.errors.notEligible',
          params: {},
          keyParams: { kind: `syncJobs.errors.kind.${kind}` },
        }
      : { key: 'syncJobs.errors.notEligibleAny' }
  }
  if (name === 'mailbox' && code === 'required')
    return { key: { legacy: 'danger.no_user_defined' } }
  return null
}

/** The message of a field violation in the language in use, falling back to the generic one. */
export function useFieldMessages() {
  const { t } = useI18n()
  const { violationMessage } = useProblemMessages()
  function render(message: FieldMessage): string {
    const named: Record<string, string> = { ...(message.params ?? {}) }
    for (const [key, ref] of Object.entries(message.keyParams ?? {})) named[key] = text(ref)
    return typeof message.key === 'string' ? t(message.key, named) : resolveText(message.key, t)
  }
  return {
    render,
    message(field: string, violation: FieldViolation): string {
      const specific = fieldMessage(field, violation)
      return specific ? render(specific) : violationMessage(violation)
    },
  }
}

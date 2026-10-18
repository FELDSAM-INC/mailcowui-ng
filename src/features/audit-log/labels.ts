// Labels of audit codes (FR-074, conventions "History and audit"). Every kind of code is looked up
// here, under `enums.<kind>.<code>`; a later feature adds the labels of its own event types to the
// locale files (npm run i18n:check requires one per contract value). A code this version does not
// know is shown with a generic label and the code, never hidden.
import type { AuditActor, AuditEvent } from '@/api'
import { hasMessage, text } from '@/i18n'

const PREFIXES = {
  eventType: 'enums.auditEventType',
  failureReason: 'enums.auditFailureReason',
  authMethod: 'enums.authMethod',
  outcome: 'enums.auditOutcome',
  targetType: 'enums.auditTargetType',
} as const

export type AuditLabelKind = keyof typeof PREFIXES

export interface LabelTranslator {
  t: (key: string, named?: Record<string, unknown>) => string
  te: (key: string) => boolean
}

export function auditLabelKey(kind: AuditLabelKind, code: string): string {
  return `${PREFIXES[kind]}.${code}`
}

export function auditLabel(kind: AuditLabelKind, code: string, tr: LabelTranslator): string {
  const key = auditLabelKey(kind, code)
  return tr.te(key) ? tr.t(key) : tr.t('auditLog.unknown', { code })
}

/**
 * Who acted (FR-072): the API key and its owner, the username and role, or the attempted username
 * of a failed sign-in.
 */
export function actorLabel(
  actor: AuditActor,
  outcome: AuditEvent['outcome'],
  tr: LabelTranslator,
): string {
  const { username, role, apiKeyId } = actor
  if (apiKeyId) {
    return username
      ? tr.t('auditLog.actor.apiKeyOf', { id: apiKeyId, username })
      : tr.t('auditLog.actor.apiKey', { id: apiKeyId })
  }
  if (!username) return tr.t('auditLog.actor.unknown')
  if (role) {
    const roleKey = `roles.${role}`
    return tr.t('auditLog.actor.withRole', {
      username,
      role: tr.te(roleKey) ? tr.t(roleKey) : role,
    })
  }
  return outcome === 'failure' ? tr.t('auditLog.actor.attempted', { username }) : username
}

/** The labels in the language in use. */
export function useAuditLabels() {
  const tr: LabelTranslator = {
    t: text,
    te: hasMessage,
  }
  return {
    label: (kind: AuditLabelKind, code: string) => auditLabel(kind, code, tr),
    actor: (event: AuditEvent) => actorLabel(event.actor, event.outcome, tr),
    method: (event: AuditEvent) =>
      event.authMethod
        ? auditLabel('authMethod', event.authMethod, tr)
        : tr.t('auditLog.notRecorded'),
  }
}

// Labels of audit codes (FR-074, conventions "History and audit"). Every kind of code is looked up
// here, under `enums.<kind>.<code>`; a later feature adds the labels of its own event types to the
// locale files (npm run i18n:check requires one per contract value). A code this version does not
// know is shown with a generic label and the code, never hidden.
import type { AuditActor, AuditEvent } from '@/api'
import { hasMessage, text } from '@/i18n'

/** A route to an audit target, as `RouterLink` takes it. */
export interface AuditLink {
  name: string
  params: Record<string, string>
}

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

/**
 * The label of a detail member (UI 003: `changes`, `passwordSet`, `previousAddress` and the others
 * of `auditLog.detailKeys`), or the member's own name for any other.
 */
export function detailLabel(key: string, tr: LabelTranslator): string {
  const name = `auditLog.detailKeys.${key}`
  return tr.te(name) ? tr.t(name) : key
}

/** The labels in the language in use. */
export function useAuditLabels() {
  const tr: LabelTranslator = {
    t: text,
    te: hasMessage,
  }
  return {
    label: (kind: AuditLabelKind, code: string) => auditLabel(kind, code, tr),
    detail: (key: string) => detailLabel(key, tr),
    actor: (event: AuditEvent) => actorLabel(event.actor, event.outcome, tr),
    method: (event: AuditEvent) =>
      event.authMethod
        ? auditLabel('authMethod', event.authMethod, tr)
        : tr.t('auditLog.notRecorded'),
  }
}

// Feature 004 (UI 004 research R19, mailcow-rest-v2 `docs/audit-events.md` "Feature 004"): the
// links back to each target and the documented detail keys as text.

const TARGET_ROUTES: Record<string, (id: string) => AuditLink> = {
  alias: (id) => ({ name: 'alias-detail', params: { aliasId: id } }),
  aliasDomain: (id) => ({ name: 'alias-domain-detail', params: { aliasDomain: id } }),
  resource: (id) => ({ name: 'resource-detail', params: { resourceAddress: id } }),
  // "Allow to send as" lives on the mailbox page (orchestrator, 2026-10-19).
  mailboxSenderSettings: (id) => ({ name: 'mailbox-detail', params: { address: id } }),
  // UI 011 (FR-002): a container's card on the dashboard.
  container: (id) => ({ name: 'operations-container', params: { containerName: id } }),
}

/** The page of an event's target, or null for a deleted or unknown one. */
export function auditTargetLink(event: AuditEvent): AuditLink | null {
  const target = event.target
  if (!target?.id || event.eventType.endsWith('Deletion')) return null
  return TARGET_ROUTES[target.type]?.(target.id) ?? null
}

/** UI 011 (FR-075): details with more lines than this are collapsed behind "Show all <n>". */
export const COLLAPSED_LINES = 10

export interface AuditDetailRow {
  key: string
  /** The detail as lines of text. */
  lines: string[]
  /** A link the detail stands for, for example the alias a copy was made from. */
  link?: AuditLink
}

/** Formats a flag; UI 003 passes Yes or No in the user's language. */
export type FlagText = (value: boolean) => string

function detailText(value: unknown, flag: FlagText = String): string {
  if (typeof value === 'boolean') return flag(value)
  if (Array.isArray(value)) return value.map((item) => detailText(item, flag)).join(', ')
  if (value !== null && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * The details of an event as text: `changes` one line per changed value with its old and new
 * value, `removed` and `creationReport` one line per entry, `copiedFromAliasId` as a link to that
 * alias; every other key verbatim (research R19). Flags go through `flag` (UI 003: Yes or No).
 */
export function auditDetailRows(event: AuditEvent, flag: FlagText = String): AuditDetailRow[] {
  return Object.entries(event.details).map(([key, value]) => {
    if (key === 'changes' && isRecord(value)) {
      return {
        key,
        lines: Object.entries(value).map(([path, change]) =>
          isRecord(change) && 'old' in change && 'new' in change
            ? `${path}: ${detailText(change.old, flag)} → ${detailText(change.new, flag)}`
            : `${path}: ${detailText(change, flag)}`,
        ),
      }
    }
    if ((key === 'removed' || key === 'creationReport') && isRecord(value)) {
      return {
        key,
        lines: Object.entries(value).map(([name, item]) => `${name}: ${detailText(item, flag)}`),
      }
    }
    if (key === 'copiedFromAliasId' && (typeof value === 'number' || typeof value === 'string')) {
      return {
        key,
        lines: [String(value)],
        link: { name: 'alias-detail', params: { aliasId: String(value) } },
      }
    }
    // UI 011 (FR-075): a list longer than the collapsed length shows one item per line, so that
    // the details view can collapse it (for example a queue deletion's queue IDs and results).
    if (Array.isArray(value) && value.length > COLLAPSED_LINES) {
      return { key, lines: value.map((item) => detailText(item, flag)) }
    }
    return { key, lines: [detailText(value, flag)] }
  })
}

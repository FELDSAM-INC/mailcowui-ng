// Summary groups of DNS diagnostics checks (FR-060, FR-062, data-model §2): every check falls into
// one group by its status and `optional` flag. The counts are computed from the checks shown, and
// their per-status totals equal the API's `summary` (SC-008).
import { dnsCheckStatusValues, type DnsCheck, type DnsCheckStatus } from '@/api'

export type SummaryGroup = 'ok' | 'needsAttention' | 'optionalNotSet' | 'notVerified'

export const SUMMARY_GROUPS: readonly SummaryGroup[] = [
  'needsAttention',
  'notVerified',
  'optionalNotSet',
  'ok',
]

export function summaryGroup(status: DnsCheckStatus, optional: boolean): SummaryGroup {
  switch (status) {
    case 'match':
    case 'informational':
      return 'ok'
    case 'mismatch':
      return 'needsAttention'
    case 'missing':
      return optional ? 'optionalNotSet' : 'needsAttention'
    default:
      // `lookupFailed`, `expectedUnknown`, and a status of a later release.
      return 'notVerified'
  }
}

/** The status label: its own for an optional missing record, generic for an unknown status. */
export function statusLabelKey(status: DnsCheckStatus, optional: boolean): string {
  if (status === 'missing' && optional) return 'dns.diagnostics.status.missingOptional'
  return (dnsCheckStatusValues as readonly string[]).includes(status)
    ? `dns.diagnostics.status.${status}`
    : 'dns.diagnostics.status.unknown'
}

/** The checks the attention filter keeps: those that need attention or were not verified. */
export function needsLook(check: Pick<DnsCheck, 'status' | 'optional'>): boolean {
  const group = summaryGroup(check.status, check.optional)
  return group === 'needsAttention' || group === 'notVerified'
}

export interface DiagnosticsSummaryCounts {
  groups: Record<SummaryGroup, number>
  statuses: Record<DnsCheckStatus, number>
  /** No required check needs attention (not verified ones are counted apart). */
  requiredCorrect: boolean
}

export function summarize(checks: readonly DnsCheck[]): DiagnosticsSummaryCounts {
  const groups: Record<SummaryGroup, number> = {
    ok: 0,
    needsAttention: 0,
    optionalNotSet: 0,
    notVerified: 0,
  }
  const statuses = Object.fromEntries(dnsCheckStatusValues.map((status) => [status, 0])) as Record<
    DnsCheckStatus,
    number
  >
  for (const check of checks) {
    groups[summaryGroup(check.status, check.optional)] += 1
    if (check.status in statuses) statuses[check.status] += 1
  }
  return { groups, statuses, requiredCorrect: groups.needsAttention === 0 }
}

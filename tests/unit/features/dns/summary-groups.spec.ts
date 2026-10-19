// Summary groups of diagnostics checks (T056, FR-060, FR-062, SC-008): the full matrix of six
// statuses with and without `optional`, the status labels, the attention filter, and per-status
// totals equal to the API's summary.
import { describe, expect, it } from 'vitest'

import { dnsCheckStatusValues, type DnsCheckStatus } from '@/api'
import {
  needsLook,
  statusLabelKey,
  summarize,
  summaryGroup,
  type SummaryGroup,
} from '@/features/dns/diagnostics/summary-groups'

import { checkOfStatus, diagnosticsResult } from './diagnostics-fixtures'

const MATRIX: Record<DnsCheckStatus, [SummaryGroup, SummaryGroup]> = {
  match: ['ok', 'ok'],
  informational: ['ok', 'ok'],
  mismatch: ['needsAttention', 'needsAttention'],
  missing: ['needsAttention', 'optionalNotSet'],
  lookupFailed: ['notVerified', 'notVerified'],
  expectedUnknown: ['notVerified', 'notVerified'],
}

describe('summary groups', () => {
  it.each(dnsCheckStatusValues)('places %s, required and optional', (status) => {
    expect(summaryGroup(status, false)).toBe(MATRIX[status][0])
    expect(summaryGroup(status, true)).toBe(MATRIX[status][1])
  })

  it('treats an unknown status as not verified', () => {
    expect(summaryGroup('somethingNew' as DnsCheckStatus, false)).toBe('notVerified')
  })

  it('names the status label, with its own label for an optional missing record', () => {
    expect(statusLabelKey('match', false)).toBe('dns.diagnostics.status.match')
    expect(statusLabelKey('missing', true)).toBe('dns.diagnostics.status.missingOptional')
    expect(statusLabelKey('missing', false)).toBe('dns.diagnostics.status.missing')
    expect(statusLabelKey('somethingNew' as DnsCheckStatus, false)).toBe(
      'dns.diagnostics.status.unknown',
    )
  })

  it('keeps checks that need attention or were not verified in the filter', () => {
    expect(needsLook(checkOfStatus('mismatch'))).toBe(true)
    expect(needsLook(checkOfStatus('lookupFailed'))).toBe(true)
    expect(needsLook(checkOfStatus('missing', true))).toBe(false)
    expect(needsLook(checkOfStatus('match'))).toBe(false)
  })

  it('counts every group and status, equal to the API summary (SC-008)', () => {
    const checks = [
      ...dnsCheckStatusValues.map((status) => checkOfStatus(status)),
      ...dnsCheckStatusValues.map((status) => checkOfStatus(status, true)),
    ]
    const result = diagnosticsResult(checks)
    const summary = summarize(result.checks)
    expect(summary.statuses).toEqual(result.summary)
    expect(summary.groups).toEqual({ ok: 4, needsAttention: 3, optionalNotSet: 1, notVerified: 4 })
    expect(summary.requiredCorrect).toBe(false)
    const fine = summarize([checkOfStatus('match'), checkOfStatus('missing', true)])
    expect(fine.requiredCorrect).toBe(true)
  })
})

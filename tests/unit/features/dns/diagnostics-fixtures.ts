// Diagnostics results for component tests, built with the mock's contract-valid factory (a check of
// every status, messages of every code with their documented parameters).
import type { DnsCheck, DnsDiagnosticsResult } from '@/api'

import { check, checkOfStatus, message, summarize } from '../../../mocks/factories/dns-diagnostics'

export { check, checkOfStatus, message }

export function diagnosticsResult(
  checks: DnsCheck[],
  overrides: Partial<DnsDiagnosticsResult> = {},
): DnsDiagnosticsResult {
  return {
    name: 'example.org',
    displayName: 'example.org',
    aliasDomain: false,
    targetDomain: null,
    serverHostname: 'mail.example.org',
    publicIpv4: '192.0.2.25',
    publicIpv6: '2001:db8::25',
    suggestedSpfRecord: 'v=spf1 mx a ~all',
    checkedAt: '2026-10-19T08:00:00.000Z',
    serverChecksIncluded: true,
    summary: summarize(checks),
    checks,
    notes: [message('propagationDelay')],
    zoneFile: '$ORIGIN example.org.\nexample.org.\tIN\tMX\t10 mail.example.org.\n',
    ...overrides,
  }
}

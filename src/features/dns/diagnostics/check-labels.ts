// The purpose of a diagnostics check from its stable identifier (research R15, data-model §2): a
// translated label per identifier of the contract, the selector of a DKIM check and the service of
// an SRV check; an identifier of a later release gets the generic "{type} record".
import type { DnsCheck } from '@/api'

export interface LabelView {
  key: string
  params: Record<string, string>
}

const LABELS: Record<string, string> = {
  a: 'serverIpv4',
  'ptr:ipv4': 'reverseIpv4',
  aaaa: 'serverIpv6',
  'ptr:ipv6': 'reverseIpv6',
  'tlsa:25': 'tlsa25',
  mx: 'mx',
  autodiscover: 'autodiscover',
  'srv:autodiscover': 'autodiscoverService',
  autoconfig: 'autoconfig',
  'mta-sts': 'mtaStsHost',
  'mta-sts-record': 'mtaStsRecord',
  'tls-rpt': 'tlsReporting',
  spf: 'spf',
  dmarc: 'dmarc',
  dkim: 'dkim',
}

/** Protocol names of the SRV checks; they are the same in every language. */
const SERVICES: Record<string, string> = {
  pop3: 'POP3',
  pop3s: 'POP3S',
  imap: 'IMAP',
  imaps: 'IMAPS',
  submission: 'Submission',
  smtps: 'SMTPS',
  sieve: 'Sieve',
}

export function checkLabel(check: Pick<DnsCheck, 'id' | 'recordType'>): LabelView {
  const known = LABELS[check.id]
  if (known) return { key: `dns.diagnostics.checks.${known}`, params: {} }
  const [kind, detail] = check.id.split(':', 2)
  if (kind === 'dkim' && detail) {
    return { key: 'dns.diagnostics.checks.dkimSelector', params: { selector: detail } }
  }
  if (kind === 'srv' && detail && SERVICES[detail]) {
    return { key: 'dns.diagnostics.checks.service', params: { service: SERVICES[detail] } }
  }
  return { key: 'dns.diagnostics.checks.generic', params: { type: check.recordType } }
}

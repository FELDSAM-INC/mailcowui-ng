// DNS diagnostics factory (UI 010 T005, research R24): checks of every status, messages of every
// code with the parameters `DnsCheckMessageCode` documents, a default template per name in
// legacy's order (server-wide checks first), and the contract result with consistent summary
// counts, the server facts and a zone file.
import {
  dnsCheckMessageCodeValues,
  type DnsCheck,
  type DnsCheckMessage,
  type DnsCheckMessageCode,
  type DnsCheckStatus,
  type DnsDiagnosticsResult,
  type Role,
} from '@/api'

import type { DiagnosticsTemplate, ScenarioState } from '../scenarios/state'
import { dkimValue, valueParts } from './dkim-key'
import { readableName } from './domain'

export type { DiagnosticsTemplate }

export const PUBLIC_IPV4 = '192.0.2.25'
export const PUBLIC_IPV6 = '2001:db8::25'
/** The IPv6 address in the expanded form the checks compare. */
export const PUBLIC_IPV6_FULL = '2001:0db8:0000:0000:0000:0000:0000:0025'
export const SPF_RECORD = 'v=spf1 mx a ~all'
export const TLSA_RECORD = `3 1 1 ${'ab12'.repeat(16)}`

type Params = Record<string, unknown>

/** Valid parameters of every code, as `DnsCheckMessageCode` documents them. */
export const MESSAGE_PARAMS: Record<DnsCheckMessageCode, Params> = {
  lookupTimeout: { timeoutSeconds: 5 },
  runTimeout: { timeoutSeconds: 30 },
  lookupError: {},
  publicAddressUnknown: { family: 'ipv4' },
  certificateUnavailable: { host: 'mail.example.org', port: 25, cause: 'starttlsRefused' },
  dkimKeyUnavailable: {},
  hostIsAlias: { target: 'mx.provider.example' },
  dkimPublicKeyDiffers: {},
  spfMultipleRecords: { count: 2 },
  spfTooManyLookups: { limit: 10 },
  spfTooManyVoidLookups: { limit: 2 },
  spfNotPass: { address: PUBLIC_IPV4, result: 'softfail' },
  spfError: { result: 'permerror' },
  matchedByAddressRecords: { ipv4: [PUBLIC_IPV4], ipv6: [PUBLIC_IPV6_FULL] },
  nullServiceRecord: {},
  noPublicIpv6: {},
  serverChecksOmitted: {},
  propagationDelay: { hours: 24 },
  spfAuthorizeAddresses: { ipv4: PUBLIC_IPV4, ipv6: PUBLIC_IPV6 },
  spfSuggestedRecord: { record: SPF_RECORD },
  spfSyntaxReference: { url: 'https://www.open-spf.org/SPF_Record_Syntax/' },
  dmarcPublishPolicy: { url: 'https://dmarc.org/overview/' },
  tlsReportingPublishRecord: { url: 'https://datatracker.ietf.org/doc/html/rfc8460' },
}

const ENGLISH: Record<DnsCheckMessageCode, (params: Params) => string> = {
  lookupTimeout: (p) => `The lookup timed out after ${String(p.timeoutSeconds)} seconds.`,
  runTimeout: (p) => `The run reached its ${String(p.timeoutSeconds)}-second limit first.`,
  lookupError: () => 'The resolver reported an error.',
  publicAddressUnknown: () => "The server's public address could not be determined.",
  certificateUnavailable: (p) =>
    `The certificate of ${String(p.host)}:${String(p.port)} could not be read (${String(p.cause)}).`,
  dkimKeyUnavailable: () => 'The stored DKIM key could not be read.',
  hostIsAlias: (p) => `The server host name is an alias of ${String(p.target)}.`,
  dkimPublicKeyDiffers: () => 'The DKIM record carries another public key.',
  spfMultipleRecords: (p) => `The name publishes ${String(p.count)} SPF records.`,
  spfTooManyLookups: (p) => `The SPF policy needs more than ${String(p.limit)} lookups.`,
  spfTooManyVoidLookups: (p) => `The SPF policy hits more than ${String(p.limit)} void lookups.`,
  spfNotPass: (p) => `SPF answers ${String(p.result)} for ${String(p.address)}.`,
  spfError: (p) => `The SPF policy could not be evaluated (${String(p.result)}).`,
  matchedByAddressRecords: () => "The name publishes the server's addresses instead of an alias.",
  nullServiceRecord: () => 'The name publishes a null service record.',
  noPublicIpv6: () => 'The server has no public IPv6 address.',
  serverChecksOmitted: () => 'Server-wide checks are run for administrators only.',
  propagationDelay: (p) => `DNS changes can take up to ${String(p.hours)} hours to show.`,
  spfAuthorizeAddresses: () => "The SPF policy must authorise the server's addresses.",
  spfSuggestedRecord: (p) => `Suggested SPF record: ${String(p.record)}`,
  spfSyntaxReference: (p) => `SPF syntax: ${String(p.url)}`,
  dmarcPublishPolicy: (p) => `Publish a DMARC policy: ${String(p.url)}`,
  tlsReportingPublishRecord: (p) => `Publish a TLS reporting record: ${String(p.url)}`,
}

/** A message of a code, with its documented parameters unless given. */
export function message(code: DnsCheckMessageCode, params?: Params): DnsCheckMessage {
  const values = params ?? MESSAGE_PARAMS[code]
  return { code, params: values, message: ENGLISH[code](values) }
}

/** Every code once. */
export const everyMessage = (): DnsCheckMessage[] =>
  dnsCheckMessageCodeValues.map((code) => message(code))

/** A check, matching by default. */
export function check(overrides: Partial<DnsCheck> = {}): DnsCheck {
  const expected = overrides.expected === undefined ? 'mail.example.org' : overrides.expected
  return {
    id: 'mx',
    scope: 'domain',
    recordName: 'example.org',
    recordType: 'MX',
    status: 'match',
    optional: false,
    expected,
    found: expected === null ? [] : [expected],
    guidance: [],
    reason: null,
    notes: [],
    ...overrides,
  }
}

/** A check of every status (optional ones as given). */
export function checkOfStatus(status: DnsCheckStatus, optional = false): DnsCheck {
  const base = { status, optional, id: `mx`, recordName: 'example.org' }
  switch (status) {
    case 'match':
      return check(base)
    case 'mismatch':
      return check({ ...base, found: ['other.example.net'], reason: message('hostIsAlias') })
    case 'missing':
      return check({ ...base, found: [] })
    case 'lookupFailed':
      return check({ ...base, found: [], reason: message('lookupTimeout') })
    case 'informational':
      return check({
        ...base,
        id: 'dmarc',
        recordName: '_dmarc.example.org',
        recordType: 'TXT',
        expected: null,
        found: ['v=DMARC1; p=reject'],
        guidance: [message('dmarcPublishPolicy')],
      })
    case 'expectedUnknown':
      return check({
        ...base,
        id: 'tlsa:25',
        scope: 'server',
        recordName: '_25._tcp.mail.example.org',
        recordType: 'TLSA',
        expected: null,
        found: [],
        reason: message('certificateUnavailable'),
      })
  }
}

/** Reverse names of the server addresses. */
const PTR_IPV4 = PUBLIC_IPV4.split('.').reverse().join('.') + '.in-addr.arpa'
const PTR_IPV6 = PUBLIC_IPV6_FULL.replaceAll(':', '').split('').reverse().join('.') + '.ip6.arpa'

/** The default, all-correct template of a name in legacy's order. */
export function defaultTemplate(state: ScenarioState, name: string): DiagnosticsTemplate {
  const host = state.serverHostname
  const alias = state.aliasDomains.find((item) => item.name === name)
  const policyDomain = alias?.target ?? name
  const policy = state.dns.policies[policyDomain]
  const key = state.dns.keys[name]
  const checks: DnsCheck[] = [
    check({ id: 'a', scope: 'server', recordName: host, recordType: 'A', expected: PUBLIC_IPV4 }),
    check({
      id: 'ptr:ipv4',
      scope: 'server',
      recordName: PTR_IPV4,
      recordType: 'PTR',
      expected: host,
    }),
    check({
      id: 'aaaa',
      scope: 'server',
      recordName: host,
      recordType: 'AAAA',
      expected: PUBLIC_IPV6_FULL,
    }),
    check({
      id: 'ptr:ipv6',
      scope: 'server',
      recordName: PTR_IPV6,
      recordType: 'PTR',
      expected: host,
    }),
    check({
      id: 'tlsa:25',
      scope: 'server',
      recordName: `_25._tcp.${host}`,
      recordType: 'TLSA',
      expected: TLSA_RECORD,
    }),
    check({ id: 'mx', recordName: name, recordType: 'MX', expected: host }),
    check({
      id: 'autodiscover',
      recordName: `autodiscover.${name}`,
      recordType: 'CNAME',
      expected: host,
    }),
    check({
      id: 'srv:autodiscover',
      recordName: `_autodiscover._tcp.${name}`,
      recordType: 'SRV',
      expected: `${host} 443`,
    }),
    check({
      id: 'autoconfig',
      recordName: `autoconfig.${name}`,
      recordType: 'CNAME',
      expected: host,
    }),
  ]
  if (policy) {
    checks.push(
      check({ id: 'mta-sts', recordName: `mta-sts.${name}`, recordType: 'CNAME', expected: host }),
      check({
        id: 'mta-sts-record',
        recordName: `_mta-sts.${name}`,
        recordType: 'TXT',
        expected: `v=STSv1;id=${policy.policyId};`,
      }),
    )
  }
  checks.push(
    check({
      id: 'tls-rpt',
      recordName: `_smtp._tls.${name}`,
      recordType: 'TXT',
      optional: true,
      status: 'missing',
      expected: null,
      found: [],
      guidance: [message('tlsReportingPublishRecord')],
    }),
    check({
      id: 'spf',
      recordName: name,
      recordType: 'TXT',
      optional: true,
      expected: null,
      found: [SPF_RECORD],
      guidance: [
        message('spfAuthorizeAddresses', { ipv4: PUBLIC_IPV4, ipv6: PUBLIC_IPV6 }),
        message('spfSuggestedRecord', { record: SPF_RECORD }),
        message('spfSyntaxReference'),
      ],
    }),
    check({
      id: 'dmarc',
      recordName: `_dmarc.${name}`,
      recordType: 'TXT',
      optional: true,
      status: 'informational',
      expected: null,
      found: ['v=DMARC1; p=reject'],
      guidance: [message('dmarcPublishPolicy')],
    }),
  )
  if (key?.selector && key.publicKey) {
    checks.push(
      check({
        id: `dkim:${key.selector}`,
        recordName: `${key.selector}._domainkey.${name}`,
        recordType: 'TXT',
        expected: dkimValue(key.publicKey),
      }),
    )
  }
  checks.push(
    check({
      id: 'srv:imaps',
      recordName: `_imaps._tcp.${name}`,
      recordType: 'SRV',
      expected: `${host} 993`,
    }),
    check({
      id: 'srv:submission',
      recordName: `_submission._tcp.${name}`,
      recordType: 'SRV',
      expected: `${host} 587`,
    }),
  )
  return { checks }
}

/** Summary counts per status. */
export function summarize(checks: readonly DnsCheck[]): DnsDiagnosticsResult['summary'] {
  const summary = {
    match: 0,
    mismatch: 0,
    missing: 0,
    lookupFailed: 0,
    informational: 0,
    expectedUnknown: 0,
  }
  for (const item of checks) summary[item.status] += 1
  return summary
}

const absolute = (host: string) => (host.endsWith('.') ? host : `${host}.`)
const quoted = (value: string) =>
  valueParts(value)
    .map((part) => `"${part}"`)
    .join(' ')

/** A zone-file line of one check inside the name, or null. */
function zoneLine(item: DnsCheck): string | null {
  const name = absolute(item.recordName)
  const value = item.expected
  if (value === null) {
    if (item.found.length === 0) return `; ${name}\tIN\t${item.recordType}\t"**TODO**"`
    return item.found.map((found) => `${name}\tIN\t${item.recordType}\t${quoted(found)}`).join('\n')
  }
  switch (item.recordType) {
    case 'MX':
      return `${name}\tIN\tMX\t10 ${absolute(value)}`
    case 'CNAME':
      return `${name}\tIN\tCNAME\t${absolute(value)}`
    case 'SRV': {
      const [target = '', port = ''] = value.split(' ')
      return `${name}\tIN\tSRV\t0 1 ${port} ${absolute(target)}`
    }
    case 'TXT':
      return `${name}\tIN\tTXT\t${quoted(value)}`
    default:
      return `${name}\tIN\t${item.recordType}\t${value}`
  }
}

/** The zone file of a result: `$ORIGIN` and one line per check inside the name. */
export function zoneFile(name: string, checks: readonly DnsCheck[]): string {
  const lines = [`$ORIGIN ${name}.`]
  for (const item of checks) {
    if (item.scope !== 'domain') continue
    if (item.recordName !== name && !item.recordName.endsWith(`.${name}`)) continue
    const line = zoneLine(item)
    if (line) lines.push(line)
  }
  return `${lines.join('\n')}\n`
}

/** The contract result of a run of a template for a role. */
export function diagnosticsResult(
  state: ScenarioState,
  name: string,
  template: DiagnosticsTemplate,
  role: Role,
): DnsDiagnosticsResult {
  const admin = role === 'admin'
  const serverChecks = admin && state.dns.capabilities.dnsDiagnostics.serverChecks
  const checks = template.checks.filter((item) => serverChecks || item.scope !== 'server')
  const notes = [...(template.notes ?? [])]
  if (!serverChecks && !notes.some((note) => note.code === 'serverChecksOmitted')) {
    notes.push(message('serverChecksOmitted'))
  }
  if (!notes.some((note) => note.code === 'propagationDelay'))
    notes.push(message('propagationDelay'))
  const alias = state.aliasDomains.find((item) => item.name === name)
  const publicIpv6 = template.publicIpv6 === undefined ? PUBLIC_IPV6 : template.publicIpv6
  return {
    name,
    displayName: readableName(name),
    aliasDomain: !!alias,
    targetDomain: alias?.target ?? null,
    serverHostname: state.serverHostname,
    publicIpv4: template.publicIpv4 === undefined ? PUBLIC_IPV4 : template.publicIpv4,
    publicIpv6,
    suggestedSpfRecord: SPF_RECORD,
    checkedAt: new Date(state.now()).toISOString(),
    serverChecksIncluded: serverChecks,
    summary: summarize(checks),
    checks,
    notes,
    zoneFile: zoneFile(name, checks),
  }
}

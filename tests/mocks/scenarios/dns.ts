// DNS scenarios of UI 010 (T006, research R24): DKIM keys, DNS capabilities, MTA-STS policies,
// diagnostics templates, the rate limit and injections. The data stands in for API 010 on the
// scenario state; `PATCH /__mock/scenarios/:id { dns: … }` changes it at runtime (another
// administrator, a concurrent change, a capability toggled by the operator).
import { createPrivateKey, generateKeyPairSync } from 'node:crypto'

import type { AuditEvent } from '@/api'

import { auditEvent } from '../factories/audit-event'
import { incompleteDkimKey, mockDkimKey, rsaKeyPair } from '../factories/dkim-key'
import { publicationOutcome } from '../factories/dkim-publication'
import { asciiName, mockDomain } from '../factories/domain'
import { check, defaultTemplate, message, PUBLIC_IPV4 } from '../factories/dns-diagnostics'
import { mockPolicy, nextPolicyId } from '../factories/mta-sts-policy'
import { assignDomains } from './domains-base'
import type { ScenarioDefinition } from './index'
import type { DnsPatch, MockDnsState, ScenarioState } from './state'

export const DNS_SERVER_HOSTNAME = 'mail.example.org'

/** API 010's defaults (upstream: selector `dkim`, publication and export off). */
export function defaultDnsCapabilities(): MockDnsState['capabilities'] {
  return {
    defaultPageSize: 25,
    maxPageSize: 1000,
    dkim: {
      defaultSelector: 'dkim',
      defaultKeySize: 2048,
      allowedKeySizes: [1024, 2048, 3072, 4096],
      selectorMaxLength: 255,
      privateKeyMaxBytes: 16384,
      importKeyLengthMin: 1024,
      importKeyLengthMax: 8192,
      bulkLimit: 100,
      dnsPublicationEnabled: false,
      privateKeyExportEnabled: false,
    },
    mtaSts: {
      version: 'STSv1',
      modes: ['enforce', 'testing', 'none'],
      defaultActive: false,
      maxAgeMin: 1,
      maxAgeMax: 31_557_600,
      mxMaxLength: 255,
    },
    dnsDiagnostics: {
      runsPerMinute: 10,
      lookupTimeoutSeconds: 5,
      runTimeoutSeconds: 30,
      serverChecks: true,
    },
  }
}

/** DNS state of a fresh scenario. */
export function initialDnsState(): Pick<ScenarioState, 'dns'> {
  return {
    dns: {
      keys: {},
      capabilities: defaultDnsCapabilities(),
      policies: {},
      diagnostics: {},
      rateLimit: { limit: 10, remaining: 10, windowStartedAt: 0 },
      publication: {},
    },
  }
}

/** Runtime changes and JSON overrides of the DNS data. */
export function applyDnsOverrides(state: ScenarioState, patch: DnsPatch): void {
  const dns = state.dns
  if (patch.capabilities) {
    const { dkim, mtaSts, dnsDiagnostics, ...rest } = patch.capabilities
    dns.capabilities = {
      ...dns.capabilities,
      ...rest,
      dkim: { ...dns.capabilities.dkim, ...dkim },
      mtaSts: { ...dns.capabilities.mtaSts, ...mtaSts },
      dnsDiagnostics: { ...dns.capabilities.dnsDiagnostics, ...dnsDiagnostics },
    }
  }
  for (const [name, change] of Object.entries(patch.keys ?? {})) {
    if (change === null) {
      delete dns.keys[name]
      continue
    }
    const { generate, ...values } = change
    const existing = dns.keys[name]
    if (existing && generate === undefined) {
      Object.assign(existing, values, { version: existing.version + 1 })
      continue
    }
    const fresh = mockDkimKey({ size: generate ?? 2048, selector: 'dkim' })
    dns.keys[name] = { ...fresh, ...values, version: (existing?.version ?? 0) + 1 }
  }
  for (const [domain, change] of Object.entries(patch.policies ?? {})) {
    const name = asciiName(domain) || domain
    if (change === null) {
      delete dns.policies[name]
      continue
    }
    const existing = dns.policies[name]
    if (!existing) {
      dns.policies[name] = mockPolicy(state, change)
      continue
    }
    const identifying =
      (change.mode !== undefined && change.mode !== existing.mode) ||
      (change.maxAge !== undefined && change.maxAge !== existing.maxAge) ||
      (change.mxHosts !== undefined && change.mxHosts.join(',') !== existing.mxHosts.join(','))
    Object.assign(existing, change, { version: existing.version + 1 })
    if (identifying) existing.policyId = nextPolicyId(state)
  }
  for (const [name, template] of Object.entries(patch.diagnostics ?? {})) {
    if (template === null) delete dns.diagnostics[name]
    else dns.diagnostics[name] = structuredClone(template)
  }
  if (patch.rateLimit) {
    dns.rateLimit = {
      limit: patch.rateLimit.limit ?? dns.rateLimit.limit,
      remaining: patch.rateLimit.remaining ?? dns.rateLimit.remaining,
      windowStartedAt: state.now(),
    }
  }
  for (const [operationId, outcome] of Object.entries(patch.publication ?? {})) {
    if (outcome === null) delete dns.publication[operationId]
    else dns.publication[operationId] = outcome
  }
  if (patch.failingBulkTargets) dns.failingBulkTargets = [...patch.failingBulkTargets]
}

/** A 253-character name of 63-character labels. */
export const LONG_NAME = `${['a', 'b', 'c'].map((letter) => letter.repeat(63)).join('.')}.${'d'.repeat(53)}.example`

/** The data of `dns-admin` (T030). */
export function setupDnsAdmin(state: ScenarioState): void {
  state.serverHostname = DNS_SERVER_HOSTNAME
  state.domains = [
    'example.org',
    'example.net',
    'bücher.example',
    'shop.example',
    LONG_NAME,
    'incomplete.example',
  ].map((name) => mockDomain({ name }))
  state.aliasDomains = [
    { name: 'example.com', target: 'example.org' },
    { name: 'missing.example', target: 'example.net' },
  ]
  state.dns.keys = {
    'example.org': mockDkimKey({ size: 2048, selector: 'dkim', slot: 0 }),
    'xn--bcher-kva.example': mockDkimKey({ size: 1024, selector: 'dkim', slot: 0 }),
    'shop.example': mockDkimKey({ size: 3072, selector: 'shop', slot: 0 }),
    [LONG_NAME]: mockDkimKey({ size: 4096, selector: 'dkim', slot: 0 }),
    'incomplete.example': incompleteDkimKey({ selector: 'dkim' }),
    'example.com': mockDkimKey({ size: 2048, selector: 'dkim', slot: 1 }),
    'old.example': mockDkimKey({ size: 2048, selector: 'old', slot: 2 }),
    'Legacy.Example': mockDkimKey({ size: 1024, selector: 'legacy', slot: 1 }),
  }
  assignDomains(state, 'reseller', ['example.org', 'example.net'])
}

function setupMany(state: ScenarioState): void {
  state.serverHostname = DNS_SERVER_HOSTNAME
  state.domains = []
  state.dns.keys = {}
  for (let index = 1; index <= 600; index += 1) {
    const name = `d${String(index).padStart(3, '0')}.example`
    state.domains.push(mockDomain({ name }))
    if (index % 5 !== 0) state.dns.keys[name] = mockDkimKey({ size: 2048, slot: index })
  }
  assignDomains(state, 'reseller', ['d001.example', 'd002.example'])
}

function setupManyMissing(state: ScenarioState): void {
  state.serverHostname = DNS_SERVER_HOSTNAME
  state.domains = []
  state.dns.keys = {}
  for (let index = 1; index <= 60; index += 1) {
    state.domains.push(mockDomain({ name: `m${String(index).padStart(2, '0')}.example` }))
  }
  for (let index = 1; index <= 5; index += 1) {
    const name = `k${index}.example`
    state.domains.push(mockDomain({ name }))
    state.dns.keys[name] = mockDkimKey({ size: 2048, slot: index })
  }
  state.aliasDomains = [{ name: 'alias-m01.example', target: 'm01.example' }]
  assignDomains(state, 'reseller', ['m01.example', 'm02.example', 'k1.example'])
}

/** All six statuses, optional checks, guidance, reasons and notes for example.org (T052). */
function allStatusesTemplate(state: ScenarioState): MockDnsState['diagnostics'][string] {
  const host = state.serverHostname
  const base = defaultTemplate(state, 'example.org').checks
  const byId = (id: string) => base.find((item) => item.id === id)!
  return {
    checks: [
      byId('a'),
      byId('ptr:ipv4'),
      byId('aaaa'),
      byId('ptr:ipv6'),
      check({
        ...byId('tlsa:25'),
        status: 'expectedUnknown',
        expected: null,
        found: [],
        reason: message('certificateUnavailable', {
          host,
          port: 25,
          cause: 'starttlsRefused',
        }),
      }),
      byId('mx'),
      check({
        ...byId('autodiscover'),
        found: [PUBLIC_IPV4],
        notes: [message('matchedByAddressRecords', { ipv4: [PUBLIC_IPV4], ipv6: [] })],
      }),
      check({ ...byId('srv:autodiscover'), status: 'missing', found: [] }),
      check({
        ...byId('autoconfig'),
        status: 'mismatch',
        found: ['mx.provider.example'],
        reason: message('hostIsAlias', { target: 'mx.provider.example' }),
      }),
      check({
        id: 'mta-sts',
        recordName: 'mta-sts.example.org',
        recordType: 'CNAME',
        expected: host,
      }),
      check({
        id: 'mta-sts-record',
        recordName: '_mta-sts.example.org',
        recordType: 'TXT',
        expected: 'v=STSv1;id=20261018120000;',
      }),
      check({
        ...byId('tls-rpt'),
        status: 'informational',
        found: ['v=TLSRPTv1; rua=mailto:tls@example.org'],
      }),
      check({
        ...byId('spf'),
        status: 'mismatch',
        found: ['v=spf1 -all'],
        reason: message('spfNotPass', { address: PUBLIC_IPV4, result: 'fail' }),
        guidance: [
          message('spfAuthorizeAddresses', { ipv4: PUBLIC_IPV4, ipv6: '2001:db8::25' }),
          message('spfSuggestedRecord', { record: 'v=spf1 mx a ~all' }),
          message('spfSyntaxReference'),
        ],
      }),
      check({ ...byId('dmarc'), status: 'missing', found: [] }),
      check({
        ...byId('dkim:dkim'),
        status: 'mismatch',
        found: ['v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAother'],
        reason: message('dkimPublicKeyDiffers'),
      }),
      check({
        ...byId('srv:imaps'),
        status: 'lookupFailed',
        found: [],
        reason: message('lookupTimeout', { timeoutSeconds: 5 }),
      }),
      byId('srv:submission'),
    ],
  }
}

function partialTemplate(state: ScenarioState): MockDnsState['diagnostics'][string] {
  const checks = defaultTemplate(state, 'example.org').checks.map((item) =>
    ['srv:imaps', 'srv:submission', 'dkim:dkim'].includes(item.id)
      ? check({
          ...item,
          status: 'lookupFailed',
          found: [],
          reason: message('runTimeout', { timeoutSeconds: 30 }),
        })
      : item,
  )
  return { checks }
}

function noIpv6Template(state: ScenarioState): MockDnsState['diagnostics'][string] {
  const checks = defaultTemplate(state, 'example.org')
    .checks.filter((item) => item.id !== 'aaaa' && item.id !== 'ptr:ipv6')
    .map((item) =>
      item.id === 'spf'
        ? {
            ...item,
            guidance: item.guidance.map((guide) =>
              guide.code === 'spfAuthorizeAddresses'
                ? message('spfAuthorizeAddresses', { ipv4: PUBLIC_IPV4, ipv6: null })
                : guide,
            ),
          }
        : item,
    )
  return { checks, publicIpv6: null, notes: [message('noPublicIpv6')] }
}

function markupTemplate(state: ScenarioState): MockDnsState['diagnostics'][string] {
  const base = defaultTemplate(state, 'example.org').checks
  return {
    checks: [
      ...base.map((item) => {
        if (item.id === 'mx') {
          return check({
            ...item,
            status: 'mismatch',
            found: [
              '<script>alert(1)</script>',
              'mail.example.org‮evil.example',
              'mx2.example.org',
            ],
          })
        }
        if (item.id === 'srv:autodiscover') return check({ ...item, status: 'missing', found: [] })
        return item
      }),
      check({
        id: 'caa',
        recordName: 'example.org',
        recordType: 'TXT',
        expected: '0 issue "letsencrypt.org"',
      }),
    ],
  }
}

/** The audit records of every DKIM and MTA-STS event type (T100). */
export function dnsAuditEvents(): AuditEvent[] {
  const admin = { username: 'admin', role: 'admin' as const, apiKeyId: null }
  const dkim = (id: string) => ({ type: 'dkimKey' as const, id, name: id })
  const policy = { type: 'mtaStsPolicy' as const, id: 'example.org', name: 'example.org' }
  const publication = publicationOutcome('published', { selector: 'mx2024' })
  return [
    auditEvent({
      eventType: 'dkimKeyImport',
      actor: admin,
      target: dkim('example.org'),
      details: {
        old: { selector: 'dkim', keyLength: 2048, publicKeySha256: 'a1'.repeat(32) },
        new: { selector: 'mx2024', keyLength: 3072, publicKeySha256: 'b2'.repeat(32) },
        overwriteRequested: true,
        dnsPublication: publication,
      },
    }),
    auditEvent({
      eventType: 'dkimKeyGeneration',
      actor: admin,
      target: dkim('example.org'),
      details: { new: { selector: 'dkim', keyLength: 2048, publicKeySha256: 'c3'.repeat(32) } },
    }),
    auditEvent({
      eventType: 'dkimKeyCopy',
      actor: admin,
      target: dkim('example.com'),
      details: { sourceName: 'example.org', new: { selector: 'dkim', keyLength: 2048 } },
    }),
    auditEvent({ eventType: 'dkimPrivateKeyExport', actor: admin, target: dkim('example.org') }),
    auditEvent({
      eventType: 'dkimPrivateKeyExport',
      outcome: 'failure',
      failureReason: 'featureDisabled',
      actor: admin,
      target: dkim('example.org'),
    }),
    auditEvent({
      eventType: 'dkimDnsPublication',
      actor: admin,
      target: dkim('example.org'),
      details: { dnsPublication: publication },
    }),
    auditEvent({
      eventType: 'dkimKeyDeletion',
      outcome: 'failure',
      failureReason: 'versionOutdated',
      actor: admin,
      target: dkim('example.com'),
    }),
    auditEvent({
      eventType: 'dkimKeyDeletion',
      actor: admin,
      target: dkim('example.com'),
      details: { old: { selector: 'dkim', keyLength: 2048 } },
    }),
    auditEvent({
      eventType: 'mtaStsPolicyCreation',
      actor: admin,
      target: policy,
      details: { newPolicyId: '20261018090000' },
    }),
    auditEvent({
      eventType: 'mtaStsPolicyUpdate',
      actor: { username: 'reseller', role: 'domainAdmin', apiKeyId: null },
      target: policy,
      details: {
        changes: { mode: { old: 'testing', new: 'enforce' } },
        oldPolicyId: '20261018090000',
        newPolicyId: '20261018100000',
      },
    }),
    auditEvent({
      eventType: 'mtaStsPolicyCreation',
      outcome: 'failure',
      failureReason: 'conflict',
      actor: admin,
      target: policy,
    }),
  ]
}

const onDnsAdmin =
  (extra?: (state: ScenarioState) => void) =>
  (state: ScenarioState): void => {
    setupDnsAdmin(state)
    extra?.(state)
  }

const FORK: DnsPatch = {
  capabilities: {
    dkim: {
      defaultSelector: 'feldhost',
      dnsPublicationEnabled: true,
      privateKeyExportEnabled: true,
    },
  },
}

export const dnsScenarios: Record<string, ScenarioDefinition> = {
  'dns-base': {
    description: 'UI 010: an administrator, upstream DNS defaults, no domains.',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      state.serverHostname = DNS_SERVER_HOSTNAME
    },
  },
  'dns-admin': {
    description:
      'UI 010 US1: an administrator with domains, alias domains, unused and incomplete DKIM keys, IDN and 253-character names.',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin(),
  },
  'dns-domain-admin': {
    description: 'UI 010 US1: the dns-admin data seen by reseller (example.org and example.net).',
    overrides: { signedInAs: 'reseller' },
    setup: onDnsAdmin(),
  },
  'dns-admin-fork': {
    description:
      'UI 010 US2, US6, US7: dns-admin with selector feldhost, publication and export on.',
    overrides: { signedInAs: 'admin', dns: FORK },
    setup: onDnsAdmin(),
  },
  'dns-empty-admin': {
    description: 'UI 010 US1: an administrator without domains or keys.',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      state.serverHostname = DNS_SERVER_HOSTNAME
    },
  },
  'dns-empty-domain-admin': {
    description: 'UI 010 US1: a domain administrator without domains.',
    overrides: { signedInAs: 'reseller' },
    setup: (state) => {
      state.serverHostname = DNS_SERVER_HOSTNAME
      assignDomains(state, 'reseller', [])
    },
  },
  'dns-many': {
    description: 'UI 010 FR-005: 600 DKIM entries, 120 of them without a key.',
    overrides: { signedInAs: 'admin' },
    setup: setupMany,
  },
  'dns-many-missing': {
    description: 'UI 010 FR-024: 60 names without a key over three pages, and five with one.',
    overrides: { signedInAs: 'admin' },
    setup: setupManyMissing,
  },
  'dns-diagnostics-all-statuses': {
    description:
      'UI 010 US3: example.org diagnostics with every status, optional checks, reasons and notes.',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin((state) => {
      state.dns.diagnostics['example.org'] = allStatusesTemplate(state)
    }),
  },
  'dns-diagnostics-partial': {
    description: 'UI 010 US3-AS6: three checks of example.org could not be run in time.',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin((state) => {
      state.dns.diagnostics['example.org'] = partialTemplate(state)
    }),
  },
  'dns-diagnostics-no-ipv6': {
    description: 'UI 010 US3: a server without a public IPv6 address.',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin((state) => {
      state.dns.diagnostics['example.org'] = noIpv6Template(state)
    }),
  },
  'dns-diagnostics-alias': {
    description:
      'UI 010 US3: the alias domain example.com of example.org, which has an MTA-STS policy.',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin((state) => {
      state.dns.policies['example.org'] = mockPolicy(state, { active: true })
      state.dns.diagnostics['example.com'] = defaultTemplate(state, 'example.com')
    }),
  },
  'dns-diagnostics-markup': {
    description:
      'UI 010 FR-078: found values with markup, bidi controls, several values, none, and the unknown check caa.',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin((state) => {
      state.dns.diagnostics['example.org'] = markupTemplate(state)
    }),
  },
  'dns-diagnostics-rate-limited': {
    description: 'UI 010 FR-091: three diagnostics runs left this minute.',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin((state) => {
      state.dns.rateLimit = { limit: 10, remaining: 3, windowStartedAt: state.now() }
    }),
  },
  'dns-mta-sts': {
    description: 'UI 010 US4: example.org with an active enforce policy, example.net without one.',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin((state) => {
      state.dns.policies['example.org'] = mockPolicy(state, {
        active: true,
        mode: 'enforce',
        mxHosts: ['mail.example.org'],
        maxAge: 604_800,
      })
    }),
  },
  'dns-admin-keys': {
    description:
      'UI 010 US5: dns-admin for import, copy, replacement and deletion (PEM fixtures in DNS_PEM_FIXTURES).',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin(),
  },
  'dns-audit-records': {
    description: 'UI 010 US8: dns-admin with audit records of every DKIM and MTA-STS event type.',
    overrides: { signedInAs: 'admin' },
    setup: onDnsAdmin((state) => {
      state.dns.policies['example.org'] = mockPolicy(state, { active: true })
      state.auditEvents = dnsAuditEvents()
    }),
  },
}

/** PEM inputs of the import tests (T075), generated once per process on first use. */
export interface DnsPemFixtures {
  /** A 2,048-bit RSA key, PKCS #8. */
  pkcs8: string
  /** A 2,048-bit RSA key, PKCS #1, with CRLF line endings and blank lines around it. */
  pkcs1Crlf: string
  /** An AES-256-CBC encrypted PKCS #8 RSA key (passphrase `secret`). */
  encrypted: string
  /** An EC (prime256v1) key, PKCS #8. */
  ec: string
  /** A 512-bit RSA key. */
  rsa512: string
  /** A text of about 17 KiB. */
  oversized: string
}

let fixtures: DnsPemFixtures | null = null

function buildFixtures(): DnsPemFixtures {
  const pkcs8 = rsaKeyPair(2048, 3).privateKeyPem
  const key = createPrivateKey(pkcs8)
  const pkcs1 = key.export({ type: 'pkcs1', format: 'pem' }).toString()
  const ec = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey
  const rsa512 = generateKeyPairSync('rsa', {
    modulusLength: 512,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey
  const line = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj\n'
  return {
    pkcs8,
    pkcs1Crlf: `\r\n${pkcs1.trim().replaceAll('\n', '\r\n')}\r\n\r\n`,
    encrypted: key
      .export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'secret' })
      .toString(),
    ec,
    rsa512,
    oversized: `-----BEGIN PRIVATE KEY-----\n${line.repeat(270)}-----END PRIVATE KEY-----\n`,
  }
}

/** The PEM inputs, built on first access. */
export const DNS_PEM_FIXTURES: DnsPemFixtures = new Proxy({} as DnsPemFixtures, {
  get(_target, property) {
    fixtures ??= buildFixtures()
    return fixtures[property as keyof DnsPemFixtures]
  },
})

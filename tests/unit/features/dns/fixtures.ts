// Contract-shaped DNS values for component tests (not the mock's factories, which generate real RSA
// keys): DKIM entries in every state and kind, and the capabilities of both roles.
import type { DkimKey, DkimKeyDetails, DnsCapabilities, Role } from '@/api'

export function keyDetails(overrides: Partial<DkimKeyDetails> = {}): DkimKeyDetails {
  const selector = overrides.selector === undefined ? 'dkim' : overrides.selector
  const value = 'v=DKIM1;k=rsa;t=s;s=email;p=' + 'A'.repeat(300)
  return {
    selector,
    keyLength: 2048,
    publicKey: 'A'.repeat(300),
    record: {
      name: `${selector}._domainkey.example.org`,
      type: 'TXT',
      value,
      valueParts: [value.slice(0, 255), value.slice(255)],
    },
    complete: true,
    missingParts: [],
    ...overrides,
  }
}

export function dkimEntry(overrides: Partial<DkimKey> = {}): DkimKey {
  return {
    name: 'example.org',
    displayName: 'example.org',
    kind: 'domain',
    targetDomain: null,
    state: 'valid',
    key: keyDetails(),
    etag: '"k1"',
    ...overrides,
  }
}

export const missingEntry = (name = 'example.net'): DkimKey =>
  dkimEntry({ name, displayName: name, state: 'missing', key: null, etag: null })

export const incompleteEntry = (): DkimKey =>
  dkimEntry({
    name: 'incomplete.example',
    displayName: 'incomplete.example',
    key: keyDetails({
      keyLength: null,
      publicKey: null,
      record: null,
      complete: false,
      missingParts: ['publicKey', 'privateKey'],
    }),
  })

export const aliasEntry = (): DkimKey =>
  dkimEntry({
    name: 'example.com',
    displayName: 'example.com',
    kind: 'aliasDomain',
    targetDomain: 'example.org',
  })

export const unusedEntry = (): DkimKey =>
  dkimEntry({
    name: 'Legacy.Example',
    displayName: 'Legacy.Example',
    kind: 'none',
    state: 'unused',
  })

export function dnsCapabilities(
  role: Role = 'admin',
  overrides: { exportOn?: boolean; publication?: boolean; selector?: string } = {},
): DnsCapabilities {
  return {
    serverHostname: 'mail.example.org',
    defaultPageSize: 25,
    maxPageSize: 1000,
    dkim: {
      defaultSelector: overrides.selector ?? 'dkim',
      defaultKeySize: 2048,
      allowedKeySizes: [1024, 2048, 3072, 4096],
      selectorMaxLength: 255,
      privateKeyMaxBytes: 16384,
      importKeyLengthMin: 1024,
      importKeyLengthMax: 8192,
      bulkLimit: 100,
      dnsPublicationEnabled: overrides.publication ?? false,
      privateKeyExportEnabled: role === 'admin' ? (overrides.exportOn ?? false) : null,
    },
    mtaSts: {
      version: 'STSv1',
      modes: ['enforce', 'testing', 'none'],
      defaultActive: false,
      maxAgeMin: 1,
      maxAgeMax: 31557600,
      mxMaxLength: 255,
    },
    dnsDiagnostics: {
      runsPerMinute: 10,
      lookupTimeoutSeconds: 5,
      runTimeoutSeconds: 30,
      serverChecks: role === 'admin',
    },
  }
}

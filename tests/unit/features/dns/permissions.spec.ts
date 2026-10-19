// The DKIM action matrix (T011, FR-002, SC-006, data-model §2): every role × entry × export ×
// publication combination, and the list-level actions.
import { describe, expect, it } from 'vitest'

import type { DkimKey, DnsCapabilities, Role } from '@/api'
import { dkimActions, dkimListActions, type DkimActions } from '@/features/dns/permissions'

const record = {
  name: 'dkim._domainkey.example.org',
  type: 'TXT' as const,
  value: 'v=DKIM1;k=rsa;t=s;s=email;p=AAAA',
  valueParts: ['v=DKIM1;k=rsa;t=s;s=email;p=AAAA'],
}
const complete = {
  selector: 'dkim',
  keyLength: 2048,
  publicKey: 'AAAA',
  record,
  complete: true,
  missingParts: [],
}
const incomplete = {
  selector: 'dkim',
  keyLength: null,
  publicKey: null,
  record: null,
  complete: false,
  missingParts: ['publicKey', 'privateKey'] as ('publicKey' | 'privateKey')[],
}

function entry(kind: DkimKey['kind'], state: DkimKey['state'], key: DkimKey['key']): DkimKey {
  return {
    name: 'example.org',
    displayName: 'example.org',
    kind,
    targetDomain: kind === 'aliasDomain' ? 'example.net' : null,
    state,
    key,
    etag: key ? '"1"' : null,
  }
}

const ENTRIES: Record<string, DkimKey> = {
  validComplete: entry('domain', 'valid', complete),
  validIncomplete: entry('domain', 'valid', incomplete),
  missing: entry('domain', 'missing', null),
  unusedComplete: entry('none', 'unused', complete),
  unusedIncomplete: entry('none', 'unused', incomplete),
  aliasDomain: entry('aliasDomain', 'valid', complete),
}

function caps(role: Role, exportOn: boolean, publication: boolean): DnsCapabilities {
  return {
    serverHostname: 'mail.example.org',
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
      dnsPublicationEnabled: publication,
      privateKeyExportEnabled: role === 'admin' ? exportOn : null,
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

function expected(name: string, role: Role, exportOn: boolean, publication: boolean): DkimActions {
  const e = ENTRIES[name]!
  const admin = role === 'admin'
  const hasKey = e.key !== null
  return {
    copyRecord: e.key?.record != null,
    generate: e.state === 'missing',
    replace: hasKey && admin,
    importOverwrite: hasKey && admin,
    copyKey: hasKey && admin && e.key!.complete,
    delete: hasKey && admin,
    export: hasKey && admin && exportOn,
    exportOffNote: hasKey && admin && !exportOn,
    publishAgain: e.key?.record != null && admin && publication,
    history: admin,
    checkDns: e.kind !== 'none',
  }
}

const cases: [string, Role, boolean, boolean][] = []
for (const role of ['admin', 'domainAdmin'] as Role[]) {
  for (const name of Object.keys(ENTRIES)) {
    for (const exportOn of [true, false]) {
      for (const publication of [true, false]) cases.push([name, role, exportOn, publication])
    }
  }
}

describe('dkimActions', () => {
  it.each(cases)('%s as %s, export %s, publication %s', (name, role, exportOn, publication) => {
    expect(dkimActions(ENTRIES[name]!, role, caps(role, exportOn, publication))).toEqual(
      expected(name, role, exportOn, publication),
    )
  })

  it('offers nothing that needs the capabilities while they are not loaded', () => {
    const actions = dkimActions(ENTRIES.validComplete!, 'admin', undefined)
    expect(actions.export).toBe(false)
    expect(actions.exportOffNote).toBe(false)
    expect(actions.publishAgain).toBe(false)
    expect(actions.replace).toBe(true)
  })

  it('never offers anything to a mailbox user', () => {
    const actions = dkimActions(ENTRIES.missing!, 'mailboxUser', caps('admin', true, true))
    expect(Object.values(actions).some(Boolean)).toBe(false)
  })
})

describe('dkimListActions', () => {
  it('gives administrators everything and domain administrators generation only', () => {
    expect(dkimListActions('admin')).toEqual({
      importFromList: true,
      selectionGenerate: true,
      selectionDelete: true,
      filterUnused: true,
      filterKindNone: true,
    })
    expect(dkimListActions('domainAdmin')).toEqual({
      importFromList: false,
      selectionGenerate: true,
      selectionDelete: false,
      filterUnused: false,
      filterKindNone: false,
    })
    expect(Object.values(dkimListActions('mailboxUser')).some(Boolean)).toBe(false)
  })
})

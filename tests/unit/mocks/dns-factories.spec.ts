// The UI 010 mock factories (T008): every output passes the contract validator, DKIM record pieces
// join to the value, policy identifiers only grow, and diagnostics summaries match their checks.
import { describe, expect, it } from 'vitest'

import { dnsCheckMessageCodeValues, dnsCheckStatusValues } from '@/api'

import { contractValidator } from '../../mocks/contract/validator'
import {
  dkimKeyBody,
  dnsEntries,
  incompleteDkimKey,
  mockDkimKey,
  valueParts,
} from '../../mocks/factories/dkim-key'
import { everyFailedOutcome, everyPublicationStatus } from '../../mocks/factories/dkim-publication'
import {
  check,
  checkOfStatus,
  defaultTemplate,
  diagnosticsResult,
  everyMessage,
  message,
  summarize,
} from '../../mocks/factories/dns-diagnostics'
import { mockPolicy, nextPolicyId, policyBody } from '../../mocks/factories/mta-sts-policy'
import { createScenarioState } from '../../mocks/scenarios'
import { DNS_PEM_FIXTURES } from '../../mocks/scenarios/dns'
import { findAccount } from '../../mocks/scenarios/state'

const validator = contractValidator()
const schema = (name: string) => `#/components/schemas/${name}`

describe('UI 010 mock factories', () => {
  it('build contract-valid DKIM entries of every kind and state', () => {
    const state = createScenarioState('dns-admin')
    const admin = findAccount(state, 'admin')!
    const entries = dnsEntries(state, admin)
    expect(entries.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(['domain', 'aliasDomain', 'none']),
    )
    for (const entry of entries) {
      const body = dkimKeyBody(entry)
      expect(validator.validateSchema(schema('DkimKey'), body), entry.name).toEqual([])
      if (body.key?.record) {
        expect(body.key.record.valueParts.join('')).toBe(body.key.record.value)
        expect(body.key.record.valueParts.every((part) => part.length <= 255)).toBe(true)
      }
    }
    const incomplete = entries.find((entry) => entry.name === 'incomplete.example')!
    expect(dkimKeyBody(incomplete).key).toMatchObject({
      complete: false,
      missingParts: ['publicKey', 'privateKey'],
      record: null,
    })
    expect(dkimKeyBody(entries.find((entry) => entry.name === 'Legacy.Example')!).state).toBe(
      'unused',
    )
  })

  it('give a 4,096-bit key a record split into several pieces', () => {
    const key = mockDkimKey({ size: 4096 })
    const body = dkimKeyBody({
      name: 'example.org',
      displayName: 'example.org',
      kind: 'domain',
      targetDomain: null,
      key,
    })
    expect(body.key?.keyLength).toBe(4096)
    expect(body.key?.record?.valueParts.length).toBeGreaterThan(2)
    expect(valueParts('x'.repeat(600))).toEqual(['x'.repeat(255), 'x'.repeat(255), 'x'.repeat(90)])
  })

  it('build change results with every publication outcome', () => {
    const entry = {
      name: 'example.org',
      displayName: 'example.org',
      kind: 'domain' as const,
      targetDomain: null,
      key: mockDkimKey(),
    }
    for (const outcome of [...everyPublicationStatus(), ...everyFailedOutcome()]) {
      expect(
        validator.validateSchema(schema('DkimKeyChangeResult'), {
          ...dkimKeyBody(entry),
          dnsPublication: outcome,
        }),
      ).toEqual([])
    }
    const incomplete = { ...entry, key: incompleteDkimKey({ selector: 'dkim' }) }
    expect(validator.validateSchema(schema('DkimKey'), dkimKeyBody(incomplete))).toEqual([])
  })

  it('build MTA-STS policies whose identifier strictly increases', () => {
    const state = createScenarioState('dns-base')
    const ids = Array.from({ length: 5 }, () => nextPolicyId(state))
    for (let index = 1; index < ids.length; index += 1) {
      expect(ids[index]! > ids[index - 1]!).toBe(true)
      expect(ids[index]).toMatch(/^[0-9]{14}$/)
    }
    const policy = mockPolicy(state, { mxHosts: ['mail.example.org', '*.example.net'] })
    const body = policyBody(state, 'example.org', policy)
    expect(validator.validateSchema(schema('MtaStsPolicy'), body)).toEqual([])
    expect(body.dnsRecords).toEqual([
      { name: '_mta-sts.example.org', type: 'TXT', value: `v=STSv1;id=${policy.policyId};` },
      { name: 'mta-sts.example.org', type: 'CNAME', value: 'mail.example.org' },
    ])
    expect(body.policyUrl).toBe('https://mta-sts.example.org/.well-known/mta-sts.txt')
  })

  it('build diagnostics results with checks of every status and every message code', () => {
    const state = createScenarioState('dns-admin')
    for (const status of dnsCheckStatusValues) {
      for (const optional of [false, true]) {
        expect(
          validator.validateSchema(schema('DnsCheck'), checkOfStatus(status, optional)),
        ).toEqual([])
      }
    }
    const messages = everyMessage()
    expect(messages.map((item) => item.code)).toEqual([...dnsCheckMessageCodeValues])
    for (const item of messages) {
      expect(validator.validateSchema(schema('DnsCheckMessage'), item)).toEqual([])
    }
    const template = {
      checks: [
        ...defaultTemplate(state, 'example.org').checks,
        check({
          id: 'caa',
          recordType: 'TXT',
          recordName: 'example.org',
          expected: null,
          found: [],
        }),
      ],
      notes: [message('noPublicIpv6')],
    }
    for (const role of ['admin', 'domainAdmin'] as const) {
      const result = diagnosticsResult(state, 'example.org', template, role)
      expect(validator.validateSchema(schema('DnsDiagnosticsResult'), result)).toEqual([])
      expect(result.summary).toEqual(summarize(result.checks))
      expect(result.zoneFile.startsWith('$ORIGIN example.org.\n')).toBe(true)
      expect(result.zoneFile.endsWith('\n')).toBe(true)
      expect(result.zoneFile).not.toContain('\r')
      expect(result.serverChecksIncluded).toBe(role === 'admin')
      expect(result.checks.some((item) => item.scope === 'server')).toBe(role === 'admin')
    }
  })

  it('summarise every scenario template consistently', () => {
    for (const name of [
      'dns-diagnostics-all-statuses',
      'dns-diagnostics-partial',
      'dns-diagnostics-no-ipv6',
      'dns-diagnostics-alias',
      'dns-diagnostics-markup',
    ]) {
      const state = createScenarioState(name)
      for (const [target, template] of Object.entries(state.dns.diagnostics)) {
        const result = diagnosticsResult(state, target, template, 'admin')
        expect(validator.validateSchema(schema('DnsDiagnosticsResult'), result), name).toEqual([])
        expect(result.summary).toEqual(summarize(result.checks))
      }
    }
    const all = createScenarioState('dns-diagnostics-all-statuses')
    const statuses = new Set(all.dns.diagnostics['example.org']!.checks.map((item) => item.status))
    expect([...statuses].sort()).toEqual([...dnsCheckStatusValues].sort())
  })

  it('offers PEM fixtures for the import tests', () => {
    expect(DNS_PEM_FIXTURES.pkcs8).toContain('-----BEGIN PRIVATE KEY-----')
    expect(DNS_PEM_FIXTURES.pkcs1Crlf).toContain('-----BEGIN RSA PRIVATE KEY-----')
    expect(DNS_PEM_FIXTURES.pkcs1Crlf).toContain('\r\n')
    expect(DNS_PEM_FIXTURES.encrypted).toContain('ENCRYPTED PRIVATE KEY')
    expect(DNS_PEM_FIXTURES.ec).toContain('-----BEGIN PRIVATE KEY-----')
    expect(DNS_PEM_FIXTURES.rsa512).toContain('PRIVATE KEY')
    expect(DNS_PEM_FIXTURES.oversized.length).toBeGreaterThan(17_000)
  })
})

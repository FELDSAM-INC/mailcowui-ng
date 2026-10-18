// The domain template form (UI 002 T081, data-model §4 "Domain template", FR-051, FR-052), which
// mirrors the classic add and edit forms: defaults, the create request, the edit values and the
// client rules.
import { describe, expect, it } from 'vitest'

import type { DomainCapabilities, DomainTemplate } from '@/api'
import {
  newTemplateValues,
  templateFormValues,
  templateValues,
  toTemplateCreateRequest,
  validateTemplate,
} from '@/features/domains/template-form'

const MIB = 1_048_576
const GIB = 1024 * MIB

const capabilities: DomainCapabilities = {
  groupwareEnabled: true,
  taggingLimit: 2,
  maxTagLength: 255,
  maxDescriptionLength: 255,
  footerTextMaxBytes: 1_048_576,
  bulkLimit: 100,
  defaultPageSize: 25,
  maxPageSize: 1000,
  quotaUnit: MIB,
  dkim: {
    defaultSelector: 'feldhost',
    defaultKeySize: 2048,
    allowedKeySizes: [1024, 2048, 3072, 4096],
    dnsPublicationEnabled: false,
  },
  templateDefaults: {
    tags: [],
    maxMailboxes: 10,
    maxAliases: 400,
    maxMailboxQuota: 10240 * MIB,
    domainQuota: 10240 * MIB,
    rateLimit: null,
    active: true,
    globalAddressList: true,
    backupMx: false,
    relayAllRecipients: false,
    relayUnknownOnly: false,
    dkimSelector: 'feldhost',
    dkimKeySize: 2048,
  },
}

const format = {
  quota: (bytes: number) => `${bytes / MIB} MiB`,
  count: (value: number) => String(value),
}

const reseller: DomainTemplate = {
  id: 2,
  name: 'Reseller',
  isDefault: false,
  tags: ['reseller'],
  maxMailboxes: 50,
  maxAliases: 500,
  maxMailboxQuota: 10 * GIB,
  domainQuota: 50 * GIB,
  rateLimit: { value: 100, frame: 'hour' },
  active: true,
  globalAddressList: false,
  backupMx: true,
  relayAllRecipients: false,
  relayUnknownOnly: false,
  dkimSelector: '',
  dkimKeySize: 1024,
  createdAt: '2026-01-02T09:00:00.000Z',
  modifiedAt: null,
  etag: '"t2"',
}

describe('newTemplateValues', () => {
  it('starts with the template defaults in MiB and the server selector (FR-052)', () => {
    expect(newTemplateValues(capabilities)).toEqual({
      name: '',
      tags: [],
      maxAliases: '400',
      maxMailboxes: '10',
      maxMailboxQuota: '10240',
      domainQuota: '10240',
      globalAddressList: true,
      active: true,
      rateLimitValue: '',
      rateLimitFrame: 'second',
      dkimSelector: 'feldhost',
      dkimKeySize: 2048,
      relay: { backupMx: false, relayAllRecipients: false, relayUnknownOnly: false },
    })
  })

  it('falls back to the documented defaults and the DKIM capabilities without template defaults', () => {
    const { templateDefaults: _omitted, ...withoutDefaults } = capabilities
    expect(newTemplateValues(withoutDefaults)).toEqual(newTemplateValues(capabilities))
  })
})

describe('the request values', () => {
  it('creates with every value, quotas in bytes and no rate limit for an empty value', () => {
    const values = { ...newTemplateValues(capabilities), name: ' Small ', maxMailboxes: '5' }
    expect(toTemplateCreateRequest(values)).toEqual({
      name: 'Small',
      tags: [],
      maxAliases: 400,
      maxMailboxes: 5,
      maxMailboxQuota: 10240 * MIB,
      domainQuota: 10240 * MIB,
      globalAddressList: true,
      active: true,
      rateLimit: null,
      dkimSelector: 'feldhost',
      dkimKeySize: 2048,
      backupMx: false,
      relayAllRecipients: false,
      relayUnknownOnly: false,
    })
  })

  it('opens a stored template and gives back its values unchanged', () => {
    const values = templateFormValues(reseller)
    expect(values).toMatchObject({
      name: 'Reseller',
      maxMailboxes: '50',
      rateLimitValue: '100',
      rateLimitFrame: 'hour',
      dkimSelector: '',
      dkimKeySize: 1024,
      relay: { backupMx: true, relayAllRecipients: false, relayUnknownOnly: false },
    })
    const { id: _i, isDefault: _d, createdAt: _c, modifiedAt: _m, etag: _e, ...stored } = reseller
    expect(templateValues(values)).toEqual(stored)
  })

  it('sends an empty selector for "no DKIM key" and a rate limit with its frame', () => {
    const values = {
      ...templateFormValues(reseller),
      dkimSelector: ' ',
      rateLimitValue: '20',
      rateLimitFrame: 'day' as const,
    }
    expect(templateValues(values)).toMatchObject({
      dkimSelector: '',
      rateLimit: { value: 20, frame: 'day' },
    })
  })
})

describe('validateTemplate', () => {
  it('names an empty template name with the classic message and limits its length', () => {
    const values = newTemplateValues(capabilities)
    expect(validateTemplate({ ...values, name: '  ' }, capabilities, format).name).toEqual([
      { key: { legacy: 'danger.template_name_invalid' } },
    ])
    expect(
      validateTemplate({ ...values, name: 'x'.repeat(256) }, capabilities, format).name,
    ).toEqual([{ key: 'validation.tooLong', params: { max: '255' } }])
  })

  it('applies the domain rules: limits, whole MiB quotas in order, tags, rate limit and DKIM', () => {
    const errors = validateTemplate(
      {
        ...newTemplateValues(capabilities),
        name: 'Bad',
        maxMailboxes: '-1',
        maxAliases: '1.5',
        maxMailboxQuota: '20480',
        domainQuota: '10240',
        tags: ['a', 'b', 'c'],
        rateLimitValue: '0',
        dkimSelector: 'bad selector',
        dkimKeySize: 512,
      },
      capabilities,
      format,
    )
    expect(Object.keys(errors).sort()).toEqual(
      [
        'maxMailboxes',
        'maxAliases',
        'maxMailboxQuota',
        'tags',
        'rateLimit.value',
        'dkimSelector',
        'dkimKeySize',
      ].sort(),
    )
    expect(errors.maxMailboxQuota![0]!.key).toBe('validation.mustNotExceed')
  })

  it('accepts an empty rate limit and selector, and a stored tag set above the limit that shrinks', () => {
    const values = { ...templateFormValues(reseller), tags: ['a', 'b', 'c'] }
    expect(validateTemplate(values, capabilities, format, ['a', 'b', 'c', 'd'])).toEqual({})
  })
})

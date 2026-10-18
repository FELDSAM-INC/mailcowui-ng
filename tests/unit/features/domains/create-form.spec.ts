// The add domain form model (UI 002 T048, data-model §4), mirroring the classic "Add domain" form:
// the Default template applied when it opens, a template choice replacing the values, the request
// with every value and the chosen action, and the client rules.
import { describe, expect, it } from 'vitest'

import type { DomainCapabilities, DomainTemplate } from '@/api'
import {
  applyTemplate,
  initialValues,
  orderTemplates,
  toCreateRequest,
  validateCreate,
} from '@/features/domains/create-form'

const MIB = 1_048_576
const GIB = 1024 * MIB

const capabilities: DomainCapabilities = {
  groupwareEnabled: true,
  taggingLimit: 3,
  maxTagLength: 255,
  maxDescriptionLength: 255,
  footerTextMaxBytes: 1_048_576,
  bulkLimit: 100,
  defaultPageSize: 25,
  maxPageSize: 1000,
  quotaUnit: MIB,
  dkim: {
    defaultSelector: 'dkim',
    defaultKeySize: 2048,
    allowedKeySizes: [1024, 2048, 3072, 4096],
    dnsPublicationEnabled: false,
  },
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
  dkimSelector: 'mail',
  dkimKeySize: 4096,
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: null,
  etag: '"t"',
}

const format = { quota: (bytes: number) => `${bytes / GIB} GiB`, count: (n: number) => String(n) }

const defaultTemplate: DomainTemplate = {
  ...reseller,
  id: 1,
  name: 'Default',
  isDefault: true,
  tags: [],
  maxMailboxes: 10,
  maxAliases: 400,
  maxMailboxQuota: 10240 * MIB,
  domainQuota: 10240 * MIB,
  rateLimit: null,
  globalAddressList: true,
  backupMx: false,
  dkimSelector: 'dkim',
  dkimKeySize: 2048,
}

describe('initial values', () => {
  it('apply the Default template, which comes first in the template choice', () => {
    expect(orderTemplates([reseller, defaultTemplate]).map((t) => t.name)).toEqual([
      'Default',
      'Reseller',
    ])
    expect(initialValues([reseller, defaultTemplate], capabilities)).toEqual({
      name: '',
      description: '',
      templateId: 1,
      tags: [],
      maxAliases: '400',
      maxMailboxes: '10',
      maxMailboxQuota: '10240',
      domainQuota: '10240',
      globalAddressList: true,
      active: true,
      rateLimitValue: '',
      rateLimitFrame: 'second',
      dkimSelector: 'dkim',
      dkimKeySize: 2048,
      relay: { backupMx: false, relayAllRecipients: false, relayUnknownOnly: false },
    })
  })

  it('without any template come from the template defaults and name no template', () => {
    expect(initialValues([], capabilities)).toMatchObject({
      templateId: null,
      maxAliases: '400',
      dkimSelector: 'dkim',
    })
  })

  it('a template choice replaces its values and keeps the domain and description', () => {
    const start = {
      ...initialValues([defaultTemplate], capabilities),
      name: 'a.example',
      description: 'A',
    }
    expect(applyTemplate({ ...start, maxMailboxes: '3' }, reseller, capabilities)).toMatchObject({
      name: 'a.example',
      description: 'A',
      templateId: 2,
      maxMailboxes: '50',
      tags: ['reseller'],
      rateLimitValue: '100',
      rateLimitFrame: 'hour',
      dkimSelector: 'mail',
      dkimKeySize: 4096,
      relay: { backupMx: true, relayAllRecipients: false, relayUnknownOnly: false },
    })
  })
})

describe('the request', () => {
  it('holds every value, quotas in bytes, the template and the chosen action', () => {
    const values = {
      ...applyTemplate(initialValues([defaultTemplate], capabilities), reseller, capabilities),
      name: ' New.Example ',
      description: ' D ',
    }
    expect(toCreateRequest(values, capabilities, true)).toEqual({
      name: 'New.Example',
      description: 'D',
      templateId: 2,
      tags: ['reseller'],
      maxAliases: 500,
      maxMailboxes: 50,
      maxMailboxQuota: 10 * GIB,
      domainQuota: 50 * GIB,
      globalAddressList: false,
      active: true,
      rateLimit: { value: 100, frame: 'hour' },
      dkimSelector: 'mail',
      dkimKeySize: 4096,
      backupMx: true,
      relayAllRecipients: false,
      relayUnknownOnly: false,
      restartGroupware: true,
    })
  })

  it('leaves out the Global Address List and the restart when the groupware is disabled', () => {
    const request = toCreateRequest(
      { ...initialValues([], capabilities), name: 'x.example' },
      { groupwareEnabled: false },
      true,
    )
    expect(request).not.toHaveProperty('globalAddressList')
    expect(request.restartGroupware).toBe(false)
    expect(request).not.toHaveProperty('templateId')
  })
})

describe('validateCreate', () => {
  it("names an invalid domain with legacy's message and applies the domain value rules", () => {
    const errors = validateCreate(
      {
        ...initialValues([defaultTemplate], capabilities),
        name: 'not a domain',
        description: 'x'.repeat(256),
        maxMailboxQuota: '20480',
        tags: ['a', 'b', 'c', 'd'],
        rateLimitValue: '0',
      },
      capabilities,
      format,
    )
    expect(errors.name).toEqual([{ key: { legacy: 'danger.domain_invalid' } }])
    expect(Object.keys(errors).sort()).toEqual(
      ['name', 'description', 'maxMailboxQuota', 'tags', 'rateLimit.value'].sort(),
    )
  })

  it('accepts a readable name and the defaults', () => {
    expect(
      validateCreate(
        { ...initialValues([defaultTemplate], capabilities), name: 'münchen.example' },
        capabilities,
        format,
      ),
    ).toEqual({})
  })
})

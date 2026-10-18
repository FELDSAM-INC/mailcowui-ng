// Every client-side limit equals its value in the pinned contract (data-model §6), so a contract
// bump cannot leave a stale limit behind.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import * as limits from '@/shared/validation/limits'

type Json = { [key: string]: unknown }

const contract = JSON.parse(
  readFileSync(join(process.cwd(), 'contract/openapi.json'), 'utf8'),
) as Json

function resolve(node: unknown): unknown {
  let current = node
  while (current && typeof current === 'object' && '$ref' in current) {
    const ref = (current as { $ref: string }).$ref
    current = pointer(ref.replace(/^#/, ''))
  }
  return current
}

function pointer(path: string): unknown {
  let node: unknown = contract
  for (const raw of path.split('/').slice(1)) {
    const part = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    node = resolve(node)
    if (!node || typeof node !== 'object') return undefined
    node = (node as Json)[part]
  }
  return resolve(node)
}

function schemaValue(schema: string, ...path: string[]): unknown {
  return pointer(['', 'components', 'schemas', schema, ...path].join('/'))
}

function queryParameter(path: string, method: string, name: string): Json {
  const operation = pointer(`/paths/${path.replace(/\//g, '~1')}/${method}`) as Json
  const parameters = (operation.parameters as unknown[]).map(resolve) as Json[]
  const parameter = parameters.find((p) => p.name === name && p.in === 'query')
  if (!parameter) throw new Error(`No query parameter ${name} on ${method} ${path}`)
  return resolve(parameter.schema) as Json
}

describe('contract limits (data-model §6)', () => {
  const cases: [keyof typeof limits, unknown][] = [
    [
      'USERNAME_MAX_LENGTH',
      schemaValue('PasswordSignInRequest', 'properties', 'username', 'maxLength'),
    ],
    [
      'PASSWORD_MAX_LENGTH',
      schemaValue('PasswordSignInRequest', 'properties', 'password', 'maxLength'),
    ],
    ['PASSKEY_NAME_MAX_LENGTH', schemaValue('PasskeyPatch', 'properties', 'name', 'maxLength')],
    [
      'PASSKEY_NAME_MAX_LENGTH',
      schemaValue('PasskeyRegistrationRequest', 'properties', 'name', 'maxLength'),
    ],
    [
      'API_KEY_NAME_MAX_LENGTH',
      schemaValue('ApiKeyCreateRequest', 'properties', 'name', 'maxLength'),
    ],
    [
      'API_KEY_OWNER_MAX_LENGTH',
      schemaValue('ApiKeyCreateRequest', 'properties', 'ownerUsername', 'maxLength'),
    ],
    ['API_KEY_OWNER_MAX_LENGTH', queryParameter('/api-keys', 'get', 'ownerUsername').maxLength],
    [
      'ALLOWED_NETWORKS_MAX_ITEMS',
      schemaValue('ApiKeyCreateRequest', 'properties', 'allowedNetworks', 'maxItems'),
    ],
    [
      'NETWORK_MAX_LENGTH',
      schemaValue('ApiKeyCreateRequest', 'properties', 'allowedNetworks', 'items', 'maxLength'),
    ],
    ['AUDIT_EVENT_TYPES_MAX_ITEMS', queryParameter('/audit-events', 'get', 'eventType').maxItems],
    ['AUDIT_ACTOR_MAX_LENGTH', queryParameter('/audit-events', 'get', 'actor').maxLength],
    ['AUDIT_ADDRESS_MAX_LENGTH', queryParameter('/audit-events', 'get', 'clientAddress').maxLength],
    // UI 002 (T021): the domain, template, footer and audit target limits.
    ['DOMAIN_TAG_FILTER_MAX_ITEMS', queryParameter('/domains', 'get', 'tag').maxItems],
    ['DOMAIN_TAG_MAX_LENGTH', (queryParameter('/domains', 'get', 'tag').items as Json).maxLength],
    ['DOMAIN_TAG_MAX_LENGTH', schemaValue('DomainTagList', 'items', 'maxLength')],
    [
      'DOMAIN_LIMIT_MIN',
      schemaValue('DomainCreateRequest', 'properties', 'maxMailboxes', 'minimum'),
    ],
    [
      'DOMAIN_LIMIT_MAX',
      schemaValue('DomainCreateRequest', 'properties', 'maxMailboxes', 'maximum'),
    ],
    ['DOMAIN_LIMIT_MAX', schemaValue('DomainCreateRequest', 'properties', 'maxAliases', 'maximum')],
    ['RATE_LIMIT_MIN', schemaValue('DomainRateLimit', 'properties', 'value', 'minimum')],
    ['RATE_LIMIT_MAX', schemaValue('DomainRateLimit', 'properties', 'value', 'maximum')],
    ['QUOTA_MAX_BYTES', schemaValue('DomainCreateRequest', 'properties', 'domainQuota', 'maximum')],
    [
      'TEMPLATE_NAME_MAX_LENGTH',
      schemaValue('DomainTemplateCreateRequest', 'properties', 'name', 'maxLength'),
    ],
    [
      'DKIM_SELECTOR_MAX_LENGTH',
      schemaValue('DomainCreateRequest', 'properties', 'dkimSelector', 'maxLength'),
    ],
    [
      'FOOTER_EXCLUSION_MAX_LENGTH',
      schemaValue('DomainFooterReplace', 'properties', 'excludedAddresses', 'items', 'maxLength'),
    ],
    ['SEARCH_MAX_LENGTH', queryParameter('/domains', 'get', 'q').maxLength],
    ['SEARCH_MAX_LENGTH', queryParameter('/domain-templates', 'get', 'q').maxLength],
    ['AUDIT_TARGET_ID_MAX_LENGTH', queryParameter('/audit-events', 'get', 'targetId').maxLength],
  ]

  it.each(cases)('%s equals the contract value', (name, expected) => {
    expect(typeof expected).toBe('number')
    expect(limits[name]).toBe(expected)
  })

  it('has the values of data-model §6', () => {
    expect(limits.API_KEY_NAME_MAX_LENGTH).toBe(255)
    expect(limits.ALLOWED_NETWORKS_MAX_ITEMS).toBe(100)
    expect(limits.NETWORK_MAX_LENGTH).toBe(49)
    expect(limits.AUDIT_EVENT_TYPES_MAX_ITEMS).toBe(20)
    expect(limits.PASSWORD_MAX_LENGTH).toBe(4096)
    expect(limits.DOMAIN_TAG_FILTER_MAX_ITEMS).toBe(100)
    expect(limits.DOMAIN_LIMIT_MAX).toBe(2_147_483_647)
    expect(limits.RATE_LIMIT_MIN).toBe(1)
    expect(limits.QUOTA_MAX_BYTES).toBe(9_007_199_254_740_992)
    expect(limits.TEMPLATE_NAME_MAX_LENGTH).toBe(255)
  })

  it('tests every exported limit', () => {
    expect(Object.keys(limits).sort()).toEqual([...new Set(cases.map(([name]) => name))].sort())
  })
})

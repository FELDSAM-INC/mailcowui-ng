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
  })

  it('tests every exported limit', () => {
    expect(Object.keys(limits).sort()).toEqual([...new Set(cases.map(([name]) => name))].sort())
  })
})

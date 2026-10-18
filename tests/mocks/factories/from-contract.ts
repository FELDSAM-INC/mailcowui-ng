// Minimal contract-valid instances of a component schema of the pinned contract, for mock objects
// of later features that UI 002 only lists (mailboxes, aliases, alias domains for the footer's
// exclusions). Each factory overrides the members it cares about; a unit test validates the result
// against the contract, so a contract change shows up there first.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type Schema = Record<string, unknown>

let spec: Schema | null = null

function contract(): Schema {
  spec ??= JSON.parse(
    readFileSync(
      process.env.MOCK_CONTRACT_PATH ?? join(process.cwd(), 'contract/openapi.json'),
      'utf8',
    ),
  ) as Schema
  return spec
}

function resolve(ref: string): Schema {
  let node: unknown = contract()
  for (const part of ref.replace(/^#\//, '').split('/')) node = (node as Schema)[part]
  return node as Schema
}

function sample(schema: Schema, depth = 0): unknown {
  if (depth > 12) return null
  if (typeof schema.$ref === 'string') return sample(resolve(schema.$ref), depth + 1)
  if ('const' in schema) return schema.const
  if (Array.isArray(schema.enum)) return schema.enum[0]
  if (Array.isArray(schema.allOf)) {
    const parts = schema.allOf.map((part) => sample(part as Schema, depth + 1))
    return parts.every((part) => part && typeof part === 'object' && !Array.isArray(part))
      ? Object.assign({}, ...parts)
      : parts[0]
  }
  const options = (schema.oneOf ?? schema.anyOf) as Schema[] | undefined
  if (Array.isArray(options)) {
    const nullable = options.find((option) => option.type === 'null')
    return nullable ? null : sample(options[0]!, depth + 1)
  }
  if (Array.isArray(schema.examples) && schema.examples.length > 0) return schema.examples[0]
  if ('default' in schema) return schema.default
  const type = Array.isArray(schema.type)
    ? schema.type.includes('null')
      ? 'null'
      : schema.type[0]
    : schema.type
  switch (type) {
    case 'null':
      return null
    case 'boolean':
      return false
    case 'integer':
    case 'number':
      return typeof schema.minimum === 'number' ? schema.minimum : 0
    case 'string':
      if (schema.format === 'date-time') return '2026-01-01T09:00:00Z'
      if (schema.format === 'email') return 'user@example.org'
      if (schema.format === 'uri') return 'https://example.org'
      return 'x'.repeat(typeof schema.minLength === 'number' ? schema.minLength : 0)
    case 'array': {
      const count = typeof schema.minItems === 'number' ? schema.minItems : 0
      return Array.from({ length: count }, () => sample(schema.items as Schema, depth + 1))
    }
    default: {
      const properties = (schema.properties ?? {}) as Record<string, Schema>
      const required = (schema.required ?? []) as string[]
      return Object.fromEntries(
        required.map((key) => [key, sample(properties[key] ?? {}, depth + 1)]),
      )
    }
  }
}

/** A minimal valid instance of `#/components/schemas/<name>`. */
export function contractSample<T>(name: string): T {
  return sample({ $ref: `#/components/schemas/${name}` }) as T
}

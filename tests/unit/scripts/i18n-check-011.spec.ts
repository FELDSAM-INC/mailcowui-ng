// UI 011 (research R19, T004, plan "Decisions at implementation" items 5 and 12): the translation
// check requires a text for every value of the monitoring enumerations the screens show, read from
// the generated enumeration arrays. The screens show only the container actions as words: states
// are legacy's running or stopped, roles and health are not shown, priorities and queue names are
// shown as returned, and the retention policy is not shown.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkCoverage,
  ENUM_NAMESPACES,
  enumValuesFromSchema,
  requiredKeys,
} from '../../../scripts/i18n/lib.mjs'

const schema = readFileSync(join(process.cwd(), 'src/api/generated/schema.ts'), 'utf8')
const generated = enumValuesFromSchema(schema)

const MONITORING = {
  containerActionValues: 'operations.enums.containerAction',
} as const

const NOT_SHOWN = [
  'containerStateValues',
  'containerRoleValues',
  'logSeverityValues',
  'mailQueueNameValues',
  'monitoringLogRetentionPolicyValues',
]

const enums = Object.fromEntries(
  Object.keys(MONITORING).map((name) => [name, generated[name] ?? []]),
) as Record<keyof typeof MONITORING, string[]>

const expected = Object.entries(MONITORING).flatMap(([name, namespace]) =>
  enums[name as keyof typeof MONITORING].map((value) => `${namespace}.${value}`),
)

describe('monitoring enumerations in the translation check', () => {
  it('reads the container actions from the generated schema', () => {
    expect(enums.containerActionValues).toEqual(['start', 'stop', 'restart'])
  })

  it('maps the container actions to their operations.enums namespace', () => {
    for (const [name, namespace] of Object.entries(MONITORING)) {
      expect(ENUM_NAMESPACES[name], name).toBe(namespace)
    }
  })

  it('does not require the enumerations the screens do not show as words', () => {
    for (const name of NOT_SHOWN) {
      expect(Object.keys(ENUM_NAMESPACES), name).not.toContain(name)
    }
  })

  it('requires every container action', () => {
    expect(requiredKeys({ enums, problemNames: [] })).toEqual(expect.arrayContaining(expected))
  })

  it('keeps them fully required with the coverage manifest', () => {
    const { required, errors } = checkCoverage({
      coverage: { partial: {}, complete: {} },
      enums,
      problemNames: [],
      contract: {},
    })
    expect(errors).toEqual([])
    expect(required).toEqual(expect.arrayContaining(expected))
  })
})

// The registry (`tests/mocks/scenarios/index.ts`) spreads every module's scenario group into one
// object, so a name defined twice silently replaced the earlier definition: UI 004's alias
// "groupware-disabled" once took the place of UI 002's domain one. Each name has one owner.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { scenarios } from '../../mocks/scenarios'

const dir = join(process.cwd(), 'tests/mocks/scenarios')
const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(
  (file) => file.endsWith('.ts') && file !== 'index.ts',
)

describe('mock scenarios', () => {
  it('defines each scenario name in one module only', async () => {
    // A module that gathers other modules' groups (UI 009's `routing/index.ts`) passes on the same
    // definitions; only different definitions under one name replace each other.
    const owners = new Map<string, Map<unknown, string[]>>()
    for (const file of files) {
      const module = (await import(join(dir, file))) as Record<string, unknown>
      for (const [name, group] of Object.entries(module)) {
        if (!name.endsWith('Scenarios') || typeof group !== 'object' || group === null) continue
        for (const [scenario, definition] of Object.entries(group)) {
          const definitions = owners.get(scenario) ?? new Map<unknown, string[]>()
          definitions.set(definition, [...(definitions.get(definition) ?? []), file])
          owners.set(scenario, definitions)
        }
      }
    }
    expect(owners.size).toBe(Object.keys(scenarios).length)
    const conflicts = [...owners]
      .filter(([, definitions]) => definitions.size > 1)
      .map(([scenario, definitions]) => [scenario, [...definitions.values()].flat()])
    expect(Object.fromEntries(conflicts)).toEqual({})
  })
})

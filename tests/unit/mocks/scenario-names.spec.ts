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
    const owners = new Map<string, string[]>()
    for (const file of files) {
      const module = (await import(join(dir, file))) as Record<string, unknown>
      for (const [name, group] of Object.entries(module)) {
        if (!name.endsWith('Scenarios') || typeof group !== 'object' || group === null) continue
        for (const scenario of Object.keys(group)) {
          owners.set(scenario, [...(owners.get(scenario) ?? []), file])
        }
      }
    }
    expect(owners.size).toBe(Object.keys(scenarios).length)
    expect(Object.fromEntries([...owners].filter(([, modules]) => modules.length > 1))).toEqual({})
  })
})

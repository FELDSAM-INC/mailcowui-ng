import { createRequire } from 'node:module'
import { expect, it } from 'vitest'

it('applies the owner-approved performance and accessibility thresholds to quarantine', () => {
  const require = createRequire(import.meta.url)
  const config = require('../../../lighthouserc.cjs') as {
    ci: {
      assert: {
        assertMatrix: { matchingUrlPattern: string; assertions: Record<string, unknown> }[]
      }
    }
  }
  const gate = config.ci.assert.assertMatrix.find((entry) =>
    new RegExp(entry.matchingUrlPattern).test('http://localhost:4173/ng/quarantine'),
  )
  expect(gate?.assertions).toEqual({
    'categories:performance': ['error', { minScore: 0.8 }],
    'categories:accessibility': ['error', { minScore: 0.9 }],
  })
})

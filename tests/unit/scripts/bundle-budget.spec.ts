// UI 011 (research R22, T006): per-chunk bundle budgets. A budgeted chunk above its gzipped limit
// fails; a budgeted chunk reachable through a static import of the entry or of the logs, mail
// queue or ban service route chunks fails; reachability only through `dynamicImports` passes; the
// initial JavaScript budget of 204,800 bytes still applies; a chunk the build does not contain yet
// is skipped with a notice.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkBudgets,
  INITIAL_BUDGET,
  type BudgetConfig,
  type Manifest,
} from '../../../scripts/bundle-budget-lib.mjs'

const fixtures = join(process.cwd(), 'tests/unit/scripts/fixtures')
const load = <T>(name: string): T => JSON.parse(readFileSync(join(fixtures, name), 'utf8')) as T

const baseManifest = () => load<Manifest>('budget-manifest.json')
const config = () => load<BudgetConfig>('budget-config.json')

/** Fake gzipped sizes by file; anything not listed is 1 KB. */
function sizes(overrides: Record<string, number> = {}) {
  return (file: string) => overrides[file] ?? 1024
}

describe('per-chunk bundle budgets', () => {
  it('passes the fixture build: budgeted chunks small and only behind dynamic imports', () => {
    const result = checkBudgets({ manifest: baseManifest(), gzipSize: sizes(), budgets: config() })
    expect(result.errors).toEqual([])
    expect(result.initialTotal).toBe(2048)
    expect(result.notices).toEqual([])
  })

  it('fails a budgeted chunk above its gzipped limit', () => {
    const result = checkBudgets({
      manifest: baseManifest(),
      gzipSize: sizes({ 'assets/LiveLineChart-d4.js': 6145 }),
      budgets: config(),
    })
    expect(result.errors).toEqual([expect.stringContaining('LiveLineChart')])
    expect(result.errors[0]).toContain('6145')
  })

  it('accepts a chunk exactly at its limit', () => {
    const result = checkBudgets({
      manifest: baseManifest(),
      gzipSize: sizes({ 'assets/DashboardPage-c3.js': 46080 }),
      budgets: config(),
    })
    expect(result.errors).toEqual([])
  })

  it('fails a budgeted chunk that the entry imports statically', () => {
    const manifest = baseManifest()
    manifest['index.html']!.imports = [
      ...(manifest['index.html']!.imports ?? []),
      'src/features/operations/charts/LiveLineChart.vue',
    ]
    const result = checkBudgets({ manifest, gzipSize: sizes(), budgets: config() })
    expect(result.errors).toEqual([expect.stringMatching(/LiveLineChart.*static.*entry/)])
  })

  it('fails marked when a forbidden route chunk reaches it through static imports', () => {
    const manifest = baseManifest()
    manifest['src/features/operations/logs/pages/LogPage.vue']!.imports = [
      'src/features/operations/dashboard/release-notes/render-release-notes.ts',
    ]
    manifest['src/features/operations/dashboard/release-notes/render-release-notes.ts']!.imports = [
      'node_modules/marked/lib/marked.esm.js',
    ]
    const result = checkBudgets({ manifest, gzipSize: sizes(), budgets: config() })
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/render-release-notes.*LogPage/),
        expect.stringMatching(/marked.*LogPage/),
      ]),
    )
  })

  it('passes when the same chunks are reachable only through dynamicImports', () => {
    const manifest = baseManifest()
    manifest['src/features/operations/mail-queue/pages/MailQueuePage.vue']!.dynamicImports = [
      'src/features/operations/charts/LiveLineChart.vue',
    ]
    const result = checkBudgets({ manifest, gzipSize: sizes(), budgets: config() })
    expect(result.errors).toEqual([])
  })

  it('still applies the initial JavaScript budget', () => {
    expect(INITIAL_BUDGET).toBe(204_800)
    const result = checkBudgets({
      manifest: baseManifest(),
      gzipSize: sizes({ 'assets/vendor-b2.js': 204_000 }),
      budgets: config(),
    })
    expect(result.initialTotal).toBe(205_024)
    expect(result.errors).toEqual([expect.stringContaining('204800')])
  })

  it('skips a budgeted or listed chunk the build does not contain yet, with a notice', () => {
    const manifest = baseManifest()
    delete manifest['src/features/operations/charts/LiveLineChart.vue']
    delete manifest['src/features/operations/fail2ban/pages/Fail2banPage.vue']
    const result = checkBudgets({ manifest, gzipSize: sizes(), budgets: config() })
    expect(result.errors).toEqual([])
    expect(result.notices).toEqual(
      expect.arrayContaining([
        expect.stringContaining('LiveLineChart'),
        expect.stringContaining('Fail2banPage'),
      ]),
    )
  })

  it('reads the repository budget file', () => {
    const repository = JSON.parse(
      readFileSync(join(process.cwd(), 'scripts/bundle-budgets.json'), 'utf8'),
    ) as BudgetConfig
    expect(repository.chunks).toEqual(
      expect.arrayContaining([
        { name: 'LiveLineChart', maxGzipBytes: 6144 },
        { name: 'DashboardPage', maxGzipBytes: 46080 },
      ]),
    )
    expect(repository.dynamicOnly).toEqual(['marked', 'render-release-notes'])
    expect(repository.forbidStaticFrom).toEqual(['LogPage', 'MailQueuePage', 'Fail2banPage'])
  })
})

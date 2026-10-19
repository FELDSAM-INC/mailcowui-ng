// Types of scripts/bundle-budget-lib.mjs, for the unit tests (tests/unit/scripts/bundle-budget.spec.ts).
export interface ManifestChunk {
  file: string
  name?: string
  src?: string
  isEntry?: boolean
  isDynamicEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
}
export type Manifest = Record<string, ManifestChunk>
export interface BudgetConfig {
  chunks?: { name: string; maxGzipBytes: number }[]
  dynamicOnly?: string[]
  forbidStaticFrom?: string[]
}
export const INITIAL_BUDGET: number
export function staticClosure(manifest: Manifest, key: string, seen?: Set<string>): Set<string>
export function entryKeys(manifest: Manifest): string[]
export function chunkMatches(key: string, chunk: ManifestChunk, name: string): boolean
export function findChunks(manifest: Manifest, name: string): string[]
export function checkBudgets(input: {
  manifest: Manifest
  gzipSize: (file: string) => number
  budgets: BudgetConfig
}): { errors: string[]; notices: string[]; initialTotal: number; initialFiles: string[] }

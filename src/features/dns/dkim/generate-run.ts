// Runs on several names (research R8, data-model §2 "Run entry", §7): DKIM generation for one name,
// a selection or every name without a key, and copies to several targets, one request per name
// through UI 004's `useSequentialCreate`. This module holds the row model of the results and the
// classifier that tells a refusal of one name (the run continues) from one of the whole form (the
// run stops).
import type {
  ApiProblem,
  DkimKey,
  DkimKeyChangeResult,
  DkimKeyKind,
  DkimListParams,
  ListMeta,
} from '@/api'
import type {
  EntryOutcome,
  EntryResult,
  RefusalScope,
} from '@/shared/composables/useSequentialCreate'

export type RunOutcome = EntryOutcome | 'skipped'

/** One name of a run and how it ended. */
export interface RunRow {
  /** The API's name of the entry (the target of a copy). */
  name: string
  /** The readable name. */
  label: string
  outcome: RunOutcome
  result?: DkimKeyChangeResult
  problem?: ApiProblem
}

/** Outcomes that "Retry" sends again. */
export const RETRYABLE: readonly RunOutcome[] = ['refused', 'unknown', 'notProcessed']

/**
 * Research R8's table: `409 dkim-key-exists`, `404` and a `422` only about the name or target
 * concern one entry; everything else (a `422` on the selector or key size, `403`, `503`, `409
 * about:blank` for an incomplete copy source, unknown problems) stops the run.
 */
export function dkimRunClassifier(problem: ApiProblem): RefusalScope {
  if (problem.is('dkim-key-exists')) return 'entry'
  if (problem.status === 404) return 'entry'
  if (problem.status === 422 && problem.fieldErrors.size > 0) {
    const paths = [...problem.fieldErrors.keys()]
    if (paths.every((path) => path === 'name' || path === 'target')) return 'entry'
  }
  return 'form'
}

/** A name to run on, with its readable form. */
export interface RunName {
  name: string
  label: string
}

type PageFetcher = (params: DkimListParams) => Promise<{ data: DkimKey[]; meta: ListMeta }>

const COLLECTION_PAGE = 1000

/**
 * "Generate keys for all names without a key" (FR-024): every missing name across all pages, with
 * the current search and kind, in name order. A one-off read, never cached.
 */
export async function collectMissingNames(
  filters: { q?: string; kind?: DkimKeyKind },
  fetchPage: PageFetcher,
): Promise<RunName[]> {
  const names: RunName[] = []
  for (let offset = 0; ; offset += COLLECTION_PAGE) {
    const page = await fetchPage({
      state: ['missing'],
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      sort: 'name',
      order: 'asc',
      limit: COLLECTION_PAGE,
      offset,
    })
    names.push(...page.data.map((entry) => ({ name: entry.name, label: entry.displayName })))
    if (page.data.length === 0 || offset + COLLECTION_PAGE >= page.meta.total) return names
  }
}

/** The first `max` names and the number of the others, for confirmations. */
export function namePreview(
  names: readonly RunName[],
  max = 10,
): { shown: string[]; more: number } {
  return {
    shown: names.slice(0, max).map((item) => item.label),
    more: Math.max(0, names.length - max),
  }
}

/** One row per runner result in order, then the names left out before sending. */
export function runRows(
  results: readonly EntryResult<DkimKeyChangeResult | undefined>[],
  skipped: readonly RunName[],
  labelOf: (name: string) => string,
): RunRow[] {
  return [
    ...results.map((item) => ({
      name: item.entry.value,
      label: labelOf(item.entry.value),
      outcome: item.outcome,
      result: item.data,
      problem: item.problem,
    })),
    ...skipped.map((item) => ({ name: item.name, label: item.label, outcome: 'skipped' as const })),
  ]
}

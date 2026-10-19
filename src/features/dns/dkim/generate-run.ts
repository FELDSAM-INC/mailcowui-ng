// Runs on several names (research R8, data-model §2 "Run entry", §7): DKIM generation for one name,
// a selection or every name without a key, and copies to several targets, one request per name
// through UI 004's `useSequentialCreate`. This module holds the row model of the results and the
// classifier that tells a refusal of one name (the run continues) from one of the whole form (the
// run stops).
import type { ApiProblem, DkimKeyChangeResult } from '@/api'
import type { EntryOutcome, RefusalScope } from '@/shared/composables/useSequentialCreate'

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

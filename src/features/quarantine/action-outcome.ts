// What an item action reports (UI 006 legacy form map part 2, D15: legacy's alerts, no step table).
// A release, a learning as spam or a removal becomes the alerts `inc/functions.quarantine.inc.php`
// returns, one per outcome, with the placeholders legacy fills (the item ID, the spam filter's
// answer). A refusal becomes its translated message and what follows it (data-model §8): back to
// the list (`404`), one re-check after `Retry-After` (busy), keep the item (refused delivery,
// `412`, `403`), a retry the user starts (`503`), or "outcome unknown" (no response). Texts may
// carry server answers, so they are always shown through PlainText.
import type { ApiProblem, QuarantineActionReport, QuarantineBulkItemResult } from '@/api'
import { hasMessage, i18n, lt, text } from '@/i18n'
import { problemMessage } from '@/i18n/problems'

export type OutcomeKind = 'success' | 'warning' | 'danger'

export interface OutcomeLine {
  kind: OutcomeKind
  text: string
}

export type FollowUp = 'return' | 'recheck' | 'keep' | 'retry' | 'unknown'

export interface ProblemOutcome {
  lines: OutcomeLine[]
  follow: FollowUp
  /** For `recheck`: the seconds to wait before the item is read again. */
  retryAfter: number | null
}

/** The wait before re-reading a busy item when the answer names none (FR-030). */
export const BUSY_RECHECK_DEFAULT_SECONDS = 5

/** The translated message of a problem, in the language in use. */
export function problemText(problem: ApiProblem): string {
  return problemMessage(problem, { t: text, te: hasMessage, locale: i18n.global.locale.value })
}

/** The alerts of a successful release or learning as spam. */
export function reportLines(report: QuarantineActionReport): OutcomeLine[] {
  const id = String(report.itemId)
  const lines: OutcomeLine[] = []
  if (report.action === 'learnAsSpam') {
    lines.push({ kind: 'success', text: lt('success.qlearn_spam', id) })
  } else {
    lines.push({ kind: 'success', text: lt('success.item_released', id) })
    if (report.learning === 'done' || report.learning === 'alreadyLearned') {
      lines.push({ kind: 'success', text: lt('success.learned_ham', id) })
    } else if (report.learning === 'failed') {
      lines.push({ kind: 'danger', text: lt('danger.ham_learn_error', report.learningError ?? '') })
    }
  }
  if (report.fuzzy === 'failed') {
    lines.push({ kind: 'warning', text: lt('warning.fuzzy_learn_error', report.fuzzyError ?? '') })
  }
  return lines
}

/** The alert of a removal. */
export function deletedLines(itemId: number): OutcomeLine[] {
  return [{ kind: 'success', text: lt('success.item_deleted', String(itemId)) }]
}

/** A refusal or a lost response of a single action. */
export function toProblemOutcome(problem: ApiProblem): ProblemOutcome {
  if (problem.kind === 'network') {
    return {
      lines: [{ kind: 'warning', text: text('problem.outcome-unknown') }],
      follow: 'unknown',
      retryAfter: null,
    }
  }
  const line = (kind: OutcomeKind) => [{ kind, text: problemText(problem) }]
  if (problem.status === 404) return { lines: line('danger'), follow: 'return', retryAfter: null }
  if (problem.is('quarantine-item-busy')) {
    return {
      lines: line('warning'),
      follow: 'recheck',
      retryAfter: problem.retryAfter ?? BUSY_RECHECK_DEFAULT_SECONDS,
    }
  }
  if (problem.is('temporary-failure') || problem.kind === 'unavailable') {
    return { lines: line('danger'), follow: 'retry', retryAfter: null }
  }
  return { lines: line('danger'), follow: 'keep', retryAfter: null }
}

/** A bulk item's lines: the single action's alerts when done, otherwise its problem, if any. */
export function bulkItemLines(
  action: 'release' | 'releaseWithoutLearning' | 'learnAsSpam' | 'delete',
  result: Pick<QuarantineBulkItemResult, 'id' | 'outcome' | 'report'> & {
    problem?: ApiProblem | undefined
  },
): OutcomeLine[] {
  if (result.outcome === 'done') {
    if (result.report) return reportLines(result.report)
    return action === 'delete' ? deletedLines(Number(result.id)) : []
  }
  return result.problem ? [{ kind: 'danger', text: problemText(result.problem) }] : []
}

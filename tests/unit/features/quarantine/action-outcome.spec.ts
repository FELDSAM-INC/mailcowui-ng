// UI 006 T046 (legacy form map part 2, D15): an action report becomes legacy's alerts, one per
// outcome, as `inc/functions.quarantine.inc.php` returns them; a refusal becomes its translated
// message and what follows (back to the list, one re-check after Retry-After, keep the item, a
// retry, or "outcome unknown").
import { describe, expect, it } from 'vitest'

import { ApiProblem, type QuarantineActionReport } from '@/api'
import {
  BUSY_RECHECK_DEFAULT_SECONDS,
  bulkItemLines,
  deletedLines,
  reportLines,
  toProblemOutcome,
} from '@/features/quarantine/action-outcome'

const report = (overrides: Partial<QuarantineActionReport> = {}): QuarantineActionReport => ({
  itemId: 7,
  queueId: 'Q7',
  action: 'release',
  delivery: 'done',
  learning: 'done',
  fuzzy: 'done',
  itemRemoved: true,
  learningError: null,
  fuzzyError: null,
  ...overrides,
})

const problem = (status: number, type: string | null, extensions: Record<string, unknown> = {}) =>
  ApiProblem.fromParts({
    kind: 'problem',
    status,
    type: type ? `/api/v2/problems/${type}` : 'about:blank',
    extensions,
  })

describe('action outcome', () => {
  it('release with learning done: released and learned as ham', () => {
    expect(reportLines(report())).toEqual([
      { kind: 'success', text: 'Item 7 released' },
      { kind: 'success', text: 'Successfully learned ID 7 as ham' },
    ])
  })

  it('release with "already learned": legacy says learned as ham too', () => {
    expect(reportLines(report({ learning: 'alreadyLearned' }))).toEqual([
      { kind: 'success', text: 'Item 7 released' },
      { kind: 'success', text: 'Successfully learned ID 7 as ham' },
    ])
  })

  it('release whose learning failed: released, then the ham learn error with the answer', () => {
    expect(
      reportLines(
        report({ learning: 'failed', fuzzy: 'notRequested', learningError: 'Rspamd: 500' }),
      ),
    ).toEqual([
      { kind: 'success', text: 'Item 7 released' },
      { kind: 'danger', text: 'Ham learn error: Rspamd: 500' },
    ])
  })

  it('a failed fuzzy step is a warning with its answer; skipped says nothing', () => {
    expect(reportLines(report({ fuzzy: 'failed', fuzzyError: 'no storage' }))).toEqual([
      { kind: 'success', text: 'Item 7 released' },
      { kind: 'success', text: 'Successfully learned ID 7 as ham' },
      { kind: 'warning', text: 'Fuzzy hash learn error: no storage' },
    ])
    expect(reportLines(report({ fuzzy: 'skipped' }))).toHaveLength(2)
  })

  it('release without learning: released only', () => {
    expect(
      reportLines(
        report({
          action: 'releaseWithoutLearning',
          learning: 'notRequested',
          fuzzy: 'notRequested',
        }),
      ),
    ).toEqual([{ kind: 'success', text: 'Item 7 released' }])
  })

  it('learn as spam: learned and deleted, and a failed fuzzy step as a warning', () => {
    const learned = report({ action: 'learnAsSpam', delivery: 'notApplicable' })
    expect(reportLines(learned)).toEqual([
      { kind: 'success', text: 'Message ID 7 was learned as spam and deleted' },
    ])
    expect(reportLines({ ...learned, fuzzy: 'failed', fuzzyError: 'x' })).toEqual([
      { kind: 'success', text: 'Message ID 7 was learned as spam and deleted' },
      { kind: 'warning', text: 'Fuzzy hash learn error: x' },
    ])
  })

  it('a removal: item deleted', () => {
    expect(deletedLines(9)).toEqual([{ kind: 'success', text: 'Item 9 successfully deleted' }])
  })

  it('404 returns to the list', () => {
    const outcome = toProblemOutcome(problem(404, null))
    expect(outcome.follow).toBe('return')
    expect(outcome.lines).toEqual([{ kind: 'danger', text: 'This item could not be found.' }])
  })

  it('busy re-checks once after Retry-After, 5 seconds by default', () => {
    const busy = toProblemOutcome(problem(409, 'quarantine-item-busy'))
    expect(busy).toMatchObject({ follow: 'recheck', retryAfter: BUSY_RECHECK_DEFAULT_SECONDS })
    expect(BUSY_RECHECK_DEFAULT_SECONDS).toBe(5)
    expect(busy.lines[0]!.text).toBe(
      'Another action is in progress for this item. It is checked again in a few seconds.',
    )
    const later = ApiProblem.fromParts({
      kind: 'problem',
      status: 409,
      type: '/api/v2/problems/quarantine-item-busy',
      retryAfter: 9,
    })
    expect(toProblemOutcome(later).retryAfter).toBe(9)
  })

  it('a refused delivery keeps the item and names the mail server’s answer', () => {
    const answer = `550 5.1.1 <${String.fromCodePoint(0x202e)}gro.elpmaxe@ecila>: unknown`
    const outcome = toProblemOutcome(
      problem(409, 'quarantine-delivery-refused', { smtpCode: 550, smtpResponse: answer }),
    )
    expect(outcome.follow).toBe('keep')
    expect(outcome.lines).toEqual([
      { kind: 'danger', text: `Message could not be released: 550 ${answer}` },
    ])
  })

  it('412 keeps the item (it is read again); 403 says access denied', () => {
    expect(toProblemOutcome(problem(412, null))).toMatchObject({ follow: 'keep' })
    const denied = toProblemOutcome(
      problem(403, 'permission-flag-required', { requiredFlags: ['quarantine'] }),
    )
    expect(denied.follow).toBe('keep')
    expect(denied.lines[0]!.text).toBe('Access denied or invalid form data')
  })

  it('503 names the service and offers a retry', () => {
    const outcome = toProblemOutcome(
      problem(503, 'temporary-failure', { dependency: 'mailServer', step: 'delivery' }),
    )
    expect(outcome.follow).toBe('retry')
    expect(outcome.lines[0]!.text).toContain('the mail server is temporarily unavailable')
  })

  it('no response: the outcome is unknown', () => {
    const outcome = toProblemOutcome(ApiProblem.fromParts({ kind: 'network' }))
    expect(outcome.follow).toBe('unknown')
    expect(outcome.lines[0]!.text).toBe(
      'It is unknown whether the action was completed. Check the result before you try again.',
    )
  })

  it('bulk items: the single action’s lines for done items, the problem for others', () => {
    expect(bulkItemLines('release', { id: '7', outcome: 'done', report: report() })).toHaveLength(2)
    expect(bulkItemLines('delete', { id: '9', outcome: 'done' })).toEqual(deletedLines(9))
    expect(
      bulkItemLines('release', {
        id: '9',
        outcome: 'failed',
        problem: problem(503, 'temporary-failure', { dependency: 'spamFilter' }),
      })[0]!.text,
    ).toContain('the spam filter is temporarily unavailable')
    expect(bulkItemLines('release', { id: '9', outcome: 'notFound' })).toEqual([])
  })
})

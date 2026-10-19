// UI 006 (T021, research R24, legacy form map part 2): the messages of the quarantine, spam policy
// and rate limit problems and rule codes, with their parameters, and the legacy messages where the
// meaning matches.
import { beforeAll, describe, expect, it } from 'vitest'

import { ApiProblem, type FieldViolation } from '@/api'
import { hasMessage, text } from '@/i18n'
import { loadLegacy } from '@/i18n/legacy'
import {
  extensionParams,
  problemMessage,
  problemMessageKey,
  violationMessage,
  type MessageTranslator,
} from '@/i18n/problems'

const tr: MessageTranslator = { t: text, te: hasMessage, locale: 'en-gb' }

const violation = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'never shown' }) as FieldViolation

const problem = (name: string, status: number, extensions: Record<string, unknown> = {}) =>
  ApiProblem.fromParts({ kind: 'problem', type: `/api/v2/problems/${name}`, status, extensions })

const RLO = String.fromCodePoint(0x202e)

beforeAll(async () => {
  await loadLegacy('en-gb')
})

describe('UI 006 problem messages', () => {
  it('says that another action is in progress for a busy item', () => {
    expect(problemMessage(problem('quarantine-item-busy', 409), tr)).toBe(
      'Another action is in progress for this item. It is checked again in a few seconds.',
    )
  })

  it("shows a refused delivery with legacy's message and the mail server's answer", () => {
    const refused = problem('quarantine-delivery-refused', 409, {
      smtpCode: 550,
      smtpResponse: `5.7.1 Rejected ${RLO}txt.exe`,
    })
    expect(problemMessageKey(refused, tr.te)).toBe('problem.quarantine-delivery-refused')
    expect(problemMessage(refused, tr)).toBe(
      `Message could not be released: 550 5.7.1 Rejected ${RLO}txt.exe`,
    )
  })

  it('formats the size limit of a message too large as a binary size', () => {
    expect(
      problemMessage(
        problem('quarantine-message-too-large', 409, { size: 12_582_912, limit: 10_485_760 }),
        tr,
      ),
    ).toBe('Message size exceeds 10 MiB.')
  })

  it("uses legacy's message for an existing list entry", () => {
    expect(
      problemMessage(problem('spam-policy-entry-exists', 409, { list: 'block', entryId: 4 }), tr),
    ).toBe('A record with given name exists')
  })

  it('names the unavailable service of a temporary failure', () => {
    for (const [dependency, service] of [
      ['sharedStore', "the server's shared store is"],
      ['spamFilter', 'the spam filter is'],
      ['mailServer', 'the mail server is'],
    ] as const) {
      const failure = problem('temporary-failure', 503, { dependency, step: 'learning' })
      expect(problemMessageKey(failure, tr.te)).toBe(
        `problem.byParam.temporary-failure.dependency.${dependency}`,
      )
      expect(problemMessage(failure, tr)).toContain(service)
    }
    // An unknown dependency keeps the general message.
    expect(problemMessageKey(problem('temporary-failure', 503, { dependency: 'x' }), tr.te)).toBe(
      'problem.temporary-failure',
    )
  })

  it("names the required flags by their legacy labels, joined by 'and' or 'or'", () => {
    const all = problem('permission-flag-required', 403, {
      requiredFlags: ['quarantine', 'quarantineAttachments'],
    })
    const any = problem('permission-flag-required', 403, {
      requiredFlags: ['quarantine', 'quarantineAttachments'],
      requiredFlagsMatch: 'any',
    })
    expect(problemMessageKey(all, tr.te)).toBe('problem.permission-flag-required')
    // `danger.access_denied` has no placeholder; the joined labels are the parameter for callers.
    expect(problemMessage(all, tr)).toBe('Access denied or invalid form data')
    expect(extensionParams(all, tr).requiredFlags).toBe(
      'Quarantine actions and Quarantine attachments',
    )
    expect(extensionParams(any, tr).requiredFlags).toBe(
      'Quarantine actions or Quarantine attachments',
    )
  })
})

describe('UI 006 rule codes', () => {
  it("uses legacy's message for an invalid pattern", () => {
    expect(violationMessage(violation('invalidFormat', { format: 'senderPattern' }), tr)).toBe(
      'Record has invalid format',
    )
  })

  it('formats the factors of notMultipleOf as a number or a size', () => {
    expect(violationMessage(violation('notMultipleOf', { factor: 0.1 }), tr)).toBe(
      'Enter a whole multiple of 0.1.',
    )
    expect(violationMessage(violation('notMultipleOf', { factor: 1_048_576 }), tr)).toBe(
      'Enter a whole multiple of 1 MiB.',
    )
  })

  it('names the field of mustNotExceed, the byte limit of tooLong and the bulk limit', () => {
    expect(
      violationMessage(violation('mustNotExceed', { field: 'rejectScore', value: 6 }), tr, {
        labelFor: () => 'Reject from',
      }),
    ).toBe('This may not be higher than Reject from (6).')
    expect(violationMessage(violation('tooLong', { max: 1_048_576, unit: 'bytes' }), tr)).toContain(
      '1 MiB',
    )
    expect(violationMessage(violation('tooMany', { max: 100 }), tr)).toBe(
      'Enter at most 100 entries.',
    )
  })

  it('names each invalidTemplate reason with its line, and falls back for an unknown one', () => {
    expect(violationMessage(violation('invalidTemplate', { reason: 'syntax', line: 1 }), tr)).toBe(
      'The template has a syntax error in line 1.',
    )
    expect(violationMessage(violation('invalidTemplate', { reason: 'timeout' }), tr)).toBe(
      'Rendering the template took too long.',
    )
    expect(violationMessage(violation('invalidTemplate', { reason: 'other' }), tr)).toBe(
      'This template cannot be used.',
    )
  })

  it('names the email and domain name formats', () => {
    expect(violationMessage(violation('invalidFormat', { format: 'email' }), tr)).toBe(
      'Enter a valid email address.',
    )
    expect(violationMessage(violation('invalidFormat', { format: 'domainName' }), tr)).toBe(
      'Enter a valid domain name, for example example.org.',
    )
  })
})

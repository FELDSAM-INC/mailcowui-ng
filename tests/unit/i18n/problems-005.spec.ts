// Problem and rule-code translations of UI 005 (T020, research R23; legacy form map part 2): the
// flag labels joined as a conjunction or disjunction, the unavailable dependency named, the
// attempts left, byte limits and stored lengths, the Sieve parser message through legacy's
// `danger.sieve_error`, pre-hashed schemes, and the new formats.
import { beforeAll, describe, expect, it } from 'vitest'

import { ApiProblem, type FieldViolation } from '@/api'
import { hasMessage, text } from '@/i18n'
import { loadLegacy } from '@/i18n/legacy'
import {
  extensionParams,
  problemMessage,
  violationMessage,
  type MessageTranslator,
} from '@/i18n/problems'

const tr: MessageTranslator = { t: text, te: hasMessage, locale: 'en-gb' }

const violation = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'never shown' }) as FieldViolation

const problem = (name: string, status: number, extensions: Record<string, unknown> = {}) =>
  ApiProblem.fromParts({ kind: 'problem', type: `/api/v2/problems/${name}`, status, extensions })

beforeAll(async () => {
  await loadLegacy('en-gb')
})

describe('problem parameters (UI 005)', () => {
  it('joins the required flags as a conjunction for all and a disjunction for any', () => {
    const all = problem('permission-flag-required', 403, {
      requiredFlags: ['appPasswds', 'pushover'],
      requiredFlagsMatch: 'all',
    })
    expect(extensionParams(all, tr).requiredFlags).toBe('Manage app passwords and Pushover')
    const any = problem('permission-flag-required', 403, {
      requiredFlags: ['appPasswds', 'pushover'],
      requiredFlagsMatch: 'any',
    })
    expect(extensionParams(any, tr).requiredFlags).toBe('Manage app passwords or Pushover')
  })

  it('names the unavailable dependency, and falls back for an unknown one', () => {
    const store = problem('temporary-failure', 503, { dependency: 'mailStore' })
    expect(problemMessage(store, tr)).toBe(
      'Nothing was changed. Temporarily unavailable: Mail server. Please try again in a moment.',
    )
    const other = problem('temporary-failure', 503, { dependency: 'somethingNew' })
    expect(problemMessage(other, tr)).toBe(text('problem.temporary-failure'))
    expect(problemMessage(problem('temporary-failure', 503), tr)).toBe(
      text('problem.temporary-failure'),
    )
  })

  it('formats attemptsRemaining as a parameter', () => {
    const failed = problem('second-factor-enrolment-failed', 400, { attemptsRemaining: 3 })
    expect(extensionParams(failed, tr).attemptsRemaining).toBe('3')
  })

  it('maps the self-service problems to legacy messages where legacy has one', () => {
    expect(problemMessage(problem('current-password-incorrect', 403), tr)).toBe(
      'Access denied or invalid form data',
    )
    expect(problemMessage(problem('last-second-factor', 409), tr)).toBe(
      'Last key cannot be deleted, please deactivate TFA instead.',
    )
    expect(problemMessage(problem('password-reset-unavailable', 403), tr)).toMatch(
      /password recovery is currently unavailable/,
    )
    expect(problemMessage(problem('groupware-disabled', 403), tr)).toMatch(/not available/)
  })
})

describe('rule codes (UI 005)', () => {
  it('tooLong with unit bytes and with stored', () => {
    expect(violationMessage(violation('tooLong', { max: 65535, unit: 'bytes' }), tr)).toContain(
      '64',
    )
    expect(violationMessage(violation('tooLong', { max: 255, stored: true }), tr)).toBe(
      'This name is too long once special characters are encoded (at most 255 characters).',
    )
  })

  it('sieveSyntax shows the parser message through danger.sieve_error', () => {
    expect(
      violationMessage(
        violation('sieveSyntax', { message: "line 2: unknown command 'fileintoo'", line: 2 }),
        tr,
      ),
    ).toBe("Sieve parser error: line 2: unknown command 'fileintoo'")
  })

  it('preHashedPassword names the scheme; missingCharacterClass uses legacy', () => {
    expect(violationMessage(violation('preHashedPassword', { scheme: 'SSHA512' }), tr)).toBe(
      'The password may not start with a hash scheme such as SSHA512.',
    )
    expect(
      violationMessage(violation('missingCharacterClass', { characterClass: 'digit' }), tr),
    ).toBe(text('validation.missingCharacterClass'))
  })

  it('has the formats email, pushoverCredential, soundName and digits', () => {
    for (const format of ['email', 'pushoverCredential', 'soundName', 'digits']) {
      expect(hasMessage(`validation.format.${format}`)).toBe(true)
      expect(violationMessage(violation('invalidFormat', { format }), tr)).not.toBe(
        text('validation.invalidFormat'),
      )
    }
  })
})

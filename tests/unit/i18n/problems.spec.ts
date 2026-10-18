// Translation of API problems and field violations (FR-075–FR-077, research R15). Messages are
// keyed by the problem type's last path segment, with fallbacks; the list of types is taken from
// the contract text and never written by hand.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ApiProblem, type FieldViolation } from '@/api'
import { createAppI18n, loadLocale } from '@/i18n'
import {
  problemMessage,
  problemMessageKey,
  violationMessage,
  violationMessageKey,
  type MessageTranslator,
} from '@/i18n/problems'

import { problemNamesFromContract } from '../../../scripts/i18n/lib.mjs'

const contractText = readFileSync('contract/openapi.json', 'utf8')

function translator(locale: 'en-gb' | 'cs-cz' | 'sk-sk' = 'en-gb'): MessageTranslator {
  const i18n = createAppI18n()
  i18n.global.locale.value = locale
  return {
    t: (key, named) => (named ? i18n.global.t(key, named) : i18n.global.t(key)),
    te: (key) => i18n.global.te(key, locale),
    locale,
  }
}

async function loaded(locale: 'cs-cz' | 'sk-sk'): Promise<MessageTranslator> {
  const i18n = createAppI18n()
  await loadLocale(i18n, locale)
  i18n.global.locale.value = locale
  return {
    t: (key, named) => (named ? i18n.global.t(key, named) : i18n.global.t(key)),
    te: (key) => i18n.global.te(key, locale),
    locale,
  }
}

const problemOf = (type: string, status = 400) =>
  ApiProblem.fromParts({ kind: 'problem', type, status, requestId: 'a'.repeat(32) })

const violation = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'English text that is never shown' }) as FieldViolation

describe('problem messages', () => {
  const names = problemNamesFromContract(contractText)

  it('finds the problem types in the contract', () => {
    expect(names).toContain('sign-in-failed')
    expect(names).toContain('csrf-token-mismatch')
    expect(names.length).toBeGreaterThanOrEqual(20)
  })

  it.each(names)('maps %s to problem.<name> with a message in every locale', async (name) => {
    const en = translator()
    const problem = problemOf(`/api/v2/problems/${name}`)
    expect(problemMessageKey(problem, en.te)).toBe(`problem.${name}`)
    for (const tr of [en, await loaded('cs-cz'), await loaded('sk-sk')]) {
      const text = problemMessage(problem, tr)
      expect(text).not.toBe(`problem.${name}`)
      expect(text.trim()).not.toBe('')
    }
  })

  it('never shows the English title or detail', () => {
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      type: '/api/v2/problems/sign-in-failed',
      status: 401,
      title: 'Sign-in failed (English title)',
      detail: 'English detail',
    })
    const text = problemMessage(problem, translator())
    expect(text).not.toContain('English')
  })

  it('falls back to problem.status.<status>, then to problem.generic', () => {
    const en = translator()
    expect(problemMessageKey(problemOf('/api/v2/problems/some-later-type', 404), en.te)).toBe(
      'problem.status.404',
    )
    expect(problemMessageKey(problemOf('about:blank', 412), en.te)).toBe('problem.status.412')
    expect(problemMessageKey(problemOf('about:blank', 419), en.te)).toBe('problem.generic')
    expect(problemMessageKey(problemOf('https://elsewhere.example/x', 418), en.te)).toBe(
      'problem.generic',
    )
  })

  it('translates transport failures', () => {
    const en = translator()
    expect(problemMessageKey(ApiProblem.fromParts({ kind: 'network' }), en.te)).toBe(
      'problem.network',
    )
    expect(
      problemMessageKey(ApiProblem.fromParts({ kind: 'unavailable', status: 502 }), en.te),
    ).toBe('problem.service-unavailable')
  })
})

describe('field violation messages', () => {
  it('formats max and min as numbers in the locale', async () => {
    const en = translator()
    expect(violationMessageKey(violation('tooLong', { max: 4096 }), en.te)).toBe(
      'validation.tooLong',
    )
    expect(violationMessage(violation('tooLong', { max: 4096 }), en)).toContain('4,096')
    const cs = await loaded('cs-cz')
    expect(violationMessage(violation('tooShort', { min: 1000 }), cs)).toMatch(/1\s000/)
  })

  it('formats allowed values as a list', () => {
    const text = violationMessage(
      violation('notInList', { allowed: ['readOnly', 'readWrite', 'admin'] }),
      translator(),
    )
    expect(text).toContain('readOnly, readWrite')
    expect(text).toMatch(/readWrite,? (and|or) admin/)
  })

  it('translates allowed roles', async () => {
    const en = translator()
    const text = violationMessage(
      violation('notEligible', { allowedRoles: ['admin', 'domainAdmin'] }),
      en,
    )
    expect(text).toContain('Administrator')
    expect(text).toContain('Domain administrator')
    expect(text).not.toContain('domainAdmin')
    const cs = await loaded('cs-cz')
    expect(
      violationMessage(violation('notEligible', { allowedRoles: ['mailboxUser'] }), cs),
    ).not.toContain('mailboxUser')
  })

  it('selects validation.format.<format> for invalidFormat', () => {
    const en = translator()
    expect(violationMessageKey(violation('invalidFormat', { format: 'ipNetwork' }), en.te)).toBe(
      'validation.format.ipNetwork',
    )
    expect(violationMessageKey(violation('invalidFormat', { format: 'totpCode' }), en.te)).toBe(
      'validation.format.totpCode',
    )
  })

  it('falls back to validation.invalidFormat for an unknown format', () => {
    const en = translator()
    expect(violationMessageKey(violation('invalidFormat', { format: 'laterFormat' }), en.te)).toBe(
      'validation.invalidFormat',
    )
    expect(violationMessageKey(violation('invalidFormat'), en.te)).toBe('validation.invalidFormat')
  })

  it('shows an unknown rule code as validation.invalid (plain values, FR-076)', () => {
    const en = translator()
    const unknown = violation('someLaterCode', { max: 3 })
    expect(violationMessageKey(unknown, en.te)).toBe('validation.invalid')
    expect(violationMessage(unknown, en)).toBe(en.t('validation.invalid'))
  })

  it('has a message for every rule code and format in every locale', async () => {
    for (const tr of [translator(), await loaded('cs-cz'), await loaded('sk-sk')]) {
      for (const code of ['required', 'tooLong', 'tooMany', 'mustBeInFuture', 'invalid']) {
        expect(tr.te(`validation.${code}`), `${tr.locale} validation.${code}`).toBe(true)
      }
      for (const format of ['dateTime', 'ipNetwork', 'ipAddress', 'totpCode', 'yubicoOtp']) {
        expect(tr.te(`validation.format.${format}`), `${tr.locale} ${format}`).toBe(true)
      }
    }
  })
})

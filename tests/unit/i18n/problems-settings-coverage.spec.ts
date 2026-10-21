import { beforeEach, describe, expect, it } from 'vitest'
import { ApiProblem, type FieldViolation } from '@/api'
import { hasMessage, i18n, loadFeatureMessages, loadLocale, lt, text } from '@/i18n'
import {
  problemMessage,
  problemMessageKey,
  violationMessage,
  violationMessageKey,
} from '@/i18n/problems'

beforeEach(async () => {
  i18n.global.locale.value = 'en-gb'
  await loadFeatureMessages('system-settings')
  await loadFeatureMessages('sync-jobs')
})
const tr = () => ({ t: text, te: hasMessage, locale: i18n.global.locale.value })
const violation = (
  code: FieldViolation['code'],
  params: Record<string, unknown> = {},
): FieldViolation => ({ code, params, message: 'PRIVATE SERVER DIAGNOSTIC' })

describe('UI013 and sync-job contract message coverage', () => {
  it.each(['en-gb', 'cs-cz', 'sk-sk'] as const)(
    'names both eligibility reasons on indexed include/exclude entries in %s',
    async (locale) => {
      await loadLocale(i18n, locale)
      i18n.global.locale.value = locale
      for (const list of ['include', 'exclude']) {
        for (const reason of ['notReceiving', 'outsideSelectedDomains']) {
          const context = { formKey: 'systemSettings.massMail.form', path: `selection.${list}.2` }
          const rule = violation('notEligible', { reason })
          const key = `systemSettings.massMail.form.errors.selection.${list}.notEligible.reason.${reason}`
          expect(violationMessageKey(rule, hasMessage, context)).toBe(key)
          const message = violationMessage(rule, tr(), context)
          expect(message).toBe(text(key))
          expect(message).not.toContain('allowedRoles')
          expect(message).not.toContain('PRIVATE SERVER DIAGNOSTIC')
        }
      }
    },
  )

  it.each(['en-gb', 'cs-cz', 'sk-sk'] as const)(
    'preserves precise settings format guidance in %s',
    async (locale) => {
      await loadLocale(i18n, locale)
      i18n.global.locale.value = locale
      for (const [format, expected] of [
        ['singleLine', text('systemSettings.appLinks.singleLine')],
        ['appLinkUrl', text('systemSettings.appLinks.appLinkUrl')],
        ['hexColor', text('systemSettings.colours.format')],
        ['origin', lt('danger.cors_invalid_origin')],
      ]) {
        const rule = violation('invalidFormat', { format })
        expect(violationMessageKey(rule, hasMessage)).toBe(`validation.format.${format}`)
        expect(violationMessage(rule, tr())).toBe(expected)
      }
    },
  )
  it.each(['en-gb', 'cs-cz', 'sk-sk'] as const)(
    'resolves every newly covered rule without server prose in %s',
    async (locale) => {
      await loadLocale(i18n, locale)
      i18n.global.locale.value = locale
      const rules = [
        violation('unsupportedImageType'),
        violation('invalidImage'),
        violation('imageDimensionsExceeded'),
        violation('unsafeSvgContent', { construct: 'PRIVATE SERVER DIAGNOSTIC' }),
        violation('insufficientContrast', { ratio: 3.2, minimum: 4.5, surface: '#ffffff' }),
        violation('invalidRegexLine', { line: 12 }),
        violation('unbalancedStructure'),
        violation('tooFew', { min: 2 }),
        violation('customParamsNotPermitted'),
        violation('optionNotAllowed', { option: 'forbidden' }),
        violation('optionContainsSpace', { token: 'value with spaces' }),
      ]
      for (const rule of rules) {
        expect(violationMessageKey(rule, hasMessage), rule.code).toBe(`validation.${rule.code}`)
        const message = violationMessage(rule, tr())
        expect(message).not.toContain('validation.')
        expect(message).not.toContain('PRIVATE SERVER DIAGNOSTIC')
        expect(message).not.toContain('{')
      }
      expect(violationMessage(violation('tooFew', { min: 2 }), tr())).toContain('2')
      expect(violationMessage(violation('invalidRegexLine', { line: 12 }), tr())).toContain('12')
    },
  )
  it('reuses the three classic image errors verbatim', () => {
    for (const [code, legacy] of [
      ['unsupportedImageType', 'danger.invalid_mime_type'],
      ['invalidImage', 'danger.img_invalid'],
      ['imageDimensionsExceeded', 'danger.img_dimensions_exceeded'],
    ] as const)
      expect(violationMessage(violation(code), tr())).toBe(lt(legacy))
  })
  it.each([
    'feature-disabled',
    'regex-map-unavailable',
    'global-sieve-filter-unavailable',
    'mass-mail-already-running',
    'mass-mail-recipient-count-changed',
  ])('maps %s without server diagnostics', (name) => {
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      type: `/api/v2/problems/${name}`,
      status: 409,
      title: 'PRIVATE SERVER DIAGNOSTIC',
      detail: 'PRIVATE SERVER DIAGNOSTIC',
    })
    expect(problemMessageKey(problem, hasMessage)).toBe(`problem.${name}`)
    expect(problemMessage(problem, tr())).not.toContain('PRIVATE SERVER DIAGNOSTIC')
    expect(problemMessage(problem, tr())).not.toContain('problem.')
  })
})

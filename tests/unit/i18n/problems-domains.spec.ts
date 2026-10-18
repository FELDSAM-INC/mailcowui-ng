// Problem and rule translations that UI 002 adds (T020, research D25, FR-064, FR-065).
import { describe, expect, it } from 'vitest'

import { ApiProblem, type FieldViolation } from '@/api'
import { createAppI18n, loadLocale } from '@/i18n'
import { problemMessage, violationMessage, type MessageTranslator } from '@/i18n/problems'

function translator(): MessageTranslator {
  const i18n = createAppI18n()
  return {
    t: (key, named) => (named ? i18n.global.t(key, named) : i18n.global.t(key)),
    te: (key) => i18n.global.te(key, 'en-gb'),
    locale: 'en-gb',
  }
}

const violation = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'never shown' }) as FieldViolation

const plain = (text: string) => text.replace(/[  ]/g, ' ')
const labels: Record<string, string> = {
  maxMailboxQuota: 'Max. quota per mailbox',
  description: 'Description',
  maxMailboxes: 'Max. possible mailboxes',
}
const labelFor = (field: string) => labels[field] ?? field

describe('violation parameters by field kind', () => {
  it('formats inUse, value, min and max of a size field as sizes', () => {
    const tr = translator()
    expect(
      plain(
        violationMessage(violation('belowInUse', { inUse: 32_212_254_720 }), tr, { kind: 'size' }),
      ),
    ).toContain('30 GiB')
    expect(plain(violationMessage(violation('belowInUse', { inUse: 8 }), tr))).toContain('8')
    expect(
      plain(
        violationMessage(
          violation('outOfRange', { min: 1_048_576, max: 9_007_199_254_740_992 }),
          tr,
          { kind: 'size' },
        ),
      ),
    ).toContain('1 MiB')
  })

  it('formats tooLong with unit bytes as a size', () => {
    expect(
      plain(
        violationMessage(violation('tooLong', { max: 1_048_576, unit: 'bytes' }), translator()),
      ),
    ).toContain('1 MiB')
  })

  it("renders mustNotExceed's field as the form's label and its value as a size", () => {
    const text = plain(
      violationMessage(
        violation('mustNotExceed', { field: 'maxMailboxQuota', value: 10_737_418_240 }),
        translator(),
        { kind: 'size', labelFor },
      ),
    )
    expect(text).toContain('Max. quota per mailbox')
    expect(text).toContain('10 GiB')
  })

  it('formats notMultipleOf factor as a size, and has messages for belowInUse, reserved and immutable', () => {
    const tr = translator()
    expect(
      plain(violationMessage(violation('notMultipleOf', { factor: 1_048_576 }), tr)),
    ).toContain('1 MiB')
    for (const code of ['belowInUse', 'reserved', 'immutable']) {
      expect(violationMessage(violation(code, { inUse: 1 }), tr)).not.toBe(
        'This value is not valid.',
      )
    }
  })

  it('has the new formats', () => {
    const tr = translator()
    for (const format of ['domainName', 'dkimSelector', 'email']) {
      expect(tr.te(`validation.format.${format}`)).toBe(true)
    }
  })

  it('still shows an unknown code as a generic invalid value', () => {
    expect(violationMessage(violation('somethingNew'), translator())).toBe(
      'This value is not valid.',
    )
  })

  it('has every new key in Czech and Slovak', async () => {
    for (const locale of ['cs-cz', 'sk-sk'] as const) {
      const i18n = createAppI18n()
      await loadLocale(i18n, locale)
      for (const key of [
        'validation.belowInUse',
        'validation.mustNotExceed',
        'validation.notMultipleOf',
        'validation.reserved',
        'validation.immutable',
        'problem.domain-not-empty',
        'problem.attribute-not-permitted',
      ]) {
        expect(i18n.global.te(key, locale)).toBe(true)
      }
    }
  })
})

describe('problem extension members', () => {
  it('interpolates the mailboxes and resources of domain-not-empty', () => {
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      type: '/api/v2/problems/domain-not-empty',
      status: 409,
      extensions: { mailboxes: 3, resources: 1 },
    })
    const text = problemMessage(problem, translator())
    expect(text).toContain('3')
    expect(text).toContain('1')
  })

  it('lists the translated attribute labels of attribute-not-permitted', () => {
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      type: '/api/v2/problems/attribute-not-permitted',
      status: 403,
      extensions: { attributes: ['description', 'maxMailboxes'] },
    })
    const text = problemMessage(problem, translator(), { labelFor })
    expect(text).toContain('Description and Max. possible mailboxes')
  })

  it('keeps the extension members of a problem response', async () => {
    const { problemFromResponse } = await import('@/api/problem')
    const problem = await problemFromResponse(
      new Response(
        JSON.stringify({
          type: '/api/v2/problems/domain-not-empty',
          title: 'x',
          status: 409,
          requestId: 'a'.repeat(32),
          mailboxes: 2,
          resources: 0,
        }),
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    )
    expect(problem.extensions).toEqual({ mailboxes: 2, resources: 0 })
  })
})

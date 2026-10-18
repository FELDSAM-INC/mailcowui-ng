// Problem and rule translations that UI 012 adds (T008, research R26, FR-068): the API 012 problem
// types, and the rule codes whose parameters select a more specific message.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ApiProblem, knownProblemTypeValues, type FieldViolation } from '@/api'
import { createAppI18n, loadLocale, lt } from '@/i18n'
import { LEGACY_TEXTS } from '@/i18n/legacy-messages'
import {
  problemMessage,
  problemMessageKey,
  violationMessage,
  violationMessageKey,
  type MessageTranslator,
} from '@/i18n/problems'

function translatorOf(i18n: ReturnType<typeof createAppI18n>, locale: string): MessageTranslator {
  return {
    t: (key, named) => {
      const classic = LEGACY_TEXTS[key]
      if (classic) return lt(classic)
      return named ? i18n.global.t(key, named) : i18n.global.t(key)
    },
    te: (key) => key in LEGACY_TEXTS || i18n.global.te(key, locale),
    locale,
  }
}

async function translator(locale: 'en-gb' | 'cs-cz' | 'sk-sk' = 'en-gb') {
  const i18n = createAppI18n()
  if (locale !== 'en-gb') await loadLocale(i18n, locale)
  i18n.global.locale.value = locale
  return translatorOf(i18n, locale)
}

const violation = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'never shown' }) as FieldViolation

const API_012_PROBLEMS = [
  'identity-provider-not-configured',
  'identity-provider-in-use',
  'single-sign-on-not-available',
  'sign-in-state-invalid',
  'identity-provider-unavailable',
  'identity-provider-session-ended',
]

const coverage = JSON.parse(readFileSync('src/i18n/coverage.json', 'utf8')) as {
  partial: { problemTypes: string[]; ValidationRuleCode: string[] }
}

describe('API 012 problem types', () => {
  it.each(API_012_PROBLEMS)('%s is known, listed and translated in every locale', async (name) => {
    expect(knownProblemTypeValues).toContain(`/api/v2/problems/${name}`)
    expect(coverage.partial.problemTypes).toContain(name)
    for (const tr of [await translator(), await translator('cs-cz'), await translator('sk-sk')]) {
      const problem = ApiProblem.fromParts({
        kind: 'problem',
        type: `/api/v2/problems/${name}`,
        status: 409,
      })
      expect(problemMessageKey(problem, tr.te)).toBe(`problem.${name}`)
      expect(problemMessage(problem, tr)).not.toMatch(/^problem\./)
    }
  })

  it("shows the classic interface's message for identity-provider-in-use", async () => {
    const tr = await translator()
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      type: '/api/v2/problems/identity-provider-in-use',
      status: 409,
      extensions: { blockingMailboxes: 3, mailboxCounts: { keycloak: 0, genericOidc: 3, ldap: 0 } },
    })
    expect(problemMessage(problem, tr)).toBe(lt('danger.authsource_in_use'))
  })
})

describe('rule codes with parameters (research R26)', () => {
  it('selects the secret-required reason, and falls back for an unknown reason', async () => {
    const tr = await translator()
    for (const reason of ['noStoredSecret', 'typeChanged', 'addressChanged']) {
      expect(violationMessageKey(violation('secretRequired', { reason }), tr.te)).toBe(
        `validation.byParam.secretRequired.reason.${reason}`,
      )
    }
    expect(violationMessageKey(violation('secretRequired', { reason: 'later' }), tr.te)).toBe(
      'validation.secretRequired',
    )
    expect(violationMessageKey(violation('secretRequired'), tr.te)).toBe(
      'validation.secretRequired',
    )
  })

  it('names a missing mailbox template', async () => {
    const tr = await translator()
    expect(violationMessageKey(violation('notFound', { resource: 'mailboxTemplate' }), tr.te)).toBe(
      'validation.byParam.notFound.resource.mailboxTemplate',
    )
    expect(violationMessageKey(violation('notFound', { resource: 'other' }), tr.te)).toBe(
      'validation.notFound',
    )
  })

  it('translates duplicate and conflictsWith, with the field label', async () => {
    const tr = await translator()
    expect(
      violationMessage(
        violation('duplicate', { duplicateOf: 'attributeMapping.0.attributeValue' }),
        tr,
      ),
    ).toBe(tr.t('validation.duplicate'))
    const text = violationMessage(
      violation('conflictsWith', { field: 'importUsers', value: true }),
      tr,
      { labelFor: (field) => (field === 'importUsers' ? 'Import Users' : field) },
    )
    expect(text).toContain('Import Users')
  })

  it.each([
    'httpUrl',
    'hostName',
    'keycloakRealm',
    'keycloakVersion',
    'scopeList',
    'ldapAttribute',
    'ldapFilter',
    'redirectUri',
    'oauthErrorCode',
  ])('selects validation.format.%s in every locale', async (format) => {
    for (const tr of [await translator(), await translator('cs-cz'), await translator('sk-sk')]) {
      expect(violationMessageKey(violation('invalidFormat', { format }), tr.te)).toBe(
        `validation.format.${format}`,
      )
    }
  })

  it('lists the API 012 rule codes in the coverage manifest', () => {
    for (const code of ['secretRequired', 'duplicate', 'conflictsWith', 'immutable']) {
      expect(coverage.partial.ValidationRuleCode).toContain(code)
    }
  })
})

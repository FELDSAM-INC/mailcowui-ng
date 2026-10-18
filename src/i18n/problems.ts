// Translated messages for API problems and field violations (FR-075–FR-077, research R15). The
// app never shows the API's English `title`, `detail` or `message`. Problems are keyed by the last
// path segment of their type, so no list of types is written by hand (constitution I). A key that
// the classic interface has a message for resolves to mailcow's own text (`./legacy-messages`,
// constitution IV 1.3.0): the translator's `t` and `te` are those of `useText()`.
import { useI18n } from 'vue-i18n'

import type { ApiProblem, FieldViolation } from '@/api'

import { formatList, formatNumber } from './format'
import { hasMessage, text } from './index'
import { isAppLocale, DEFAULT_LOCALE, type AppLocale } from './locales'

export interface MessageTranslator {
  t: (key: string, named?: Record<string, unknown>) => string
  te: (key: string) => boolean
  locale: string
}

/** `problem.<name>`, then `problem.status.<status>`, then `problem.generic`. */
export function problemMessageKey(problem: ApiProblem, te: (key: string) => boolean): string {
  if (problem.kind === 'network') return 'problem.network'
  if (problem.kind === 'unavailable') return 'problem.service-unavailable'
  const name = problem.problemName
  if (name && te(`problem.${name}`)) return `problem.${name}`
  if (problem.status !== null && te(`problem.status.${problem.status}`)) {
    return `problem.status.${problem.status}`
  }
  return 'problem.generic'
}

export function problemMessage(problem: ApiProblem, tr: MessageTranslator): string {
  return tr.t(problemMessageKey(problem, tr.te))
}

/** `validation.<code>`, `validation.format.<format>` for `invalidFormat`, else `validation.invalid`. */
export function violationMessageKey(
  violation: FieldViolation,
  te: (key: string) => boolean,
): string {
  const code = String(violation.code)
  if (code === 'invalidFormat') {
    const format = violation.params?.format
    if (typeof format === 'string' && te(`validation.format.${format}`)) {
      return `validation.format.${format}`
    }
    return 'validation.invalidFormat'
  }
  return te(`validation.${code}`) ? `validation.${code}` : 'validation.invalid'
}

function localeOf(tr: MessageTranslator): AppLocale {
  return isAppLocale(tr.locale) ? tr.locale : DEFAULT_LOCALE
}

/** Rule parameters as display strings: numbers formatted, lists joined, roles translated. */
export function violationParams(
  violation: FieldViolation,
  tr: MessageTranslator,
): Record<string, string> {
  const locale = localeOf(tr)
  const params = (violation.params ?? {}) as Record<string, unknown>
  const named: Record<string, string> = {}
  for (const key of ['min', 'max'] as const) {
    const value = params[key]
    if (typeof value === 'number') named[key] = formatNumber(value, locale)
  }
  if (Array.isArray(params.allowed)) {
    named.allowed = formatList(params.allowed.map(String), locale)
  }
  if (Array.isArray(params.allowedRoles)) {
    const roles = params.allowedRoles.map((role) => {
      const key = `roles.${String(role)}`
      return tr.te(key) ? tr.t(key) : String(role)
    })
    named.allowedRoles = formatList(roles, locale)
  }
  if (typeof params.expected === 'string') named.expected = params.expected
  return named
}

export function violationMessage(violation: FieldViolation, tr: MessageTranslator): string {
  const key = violationMessageKey(violation, tr.te)
  if (key === 'validation.invalid') return tr.t(key)
  return tr.t(key, violationParams(violation, tr))
}

/** Problem and violation messages in the language in use. */
export function useProblemMessages() {
  const composer = useI18n({ useScope: 'global' })
  const tr = (): MessageTranslator => ({
    t: text,
    te: hasMessage,
    locale: composer.locale.value,
  })
  return {
    problemMessage: (problem: ApiProblem) => problemMessage(problem, tr()),
    violationMessage: (violation: FieldViolation) => violationMessage(violation, tr()),
  }
}

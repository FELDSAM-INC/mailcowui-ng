// Translated messages for API problems and field violations (FR-075–FR-077, research R15). The
// app never shows the API's English `title`, `detail` or `message`. Problems are keyed by the last
// path segment of their type, so no list of types is written by hand (constitution I). A key that
// the classic interface has a message for resolves to mailcow's own text (`./legacy-messages`,
// constitution IV 1.3.0): the translator's `t` and `te` are those of `useText()`.
import { useI18n } from 'vue-i18n'

import type { ApiProblem, FieldViolation } from '@/api'

import { formatBytes, formatList, formatNumber } from './format'
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

/**
 * How a form presents a problem or violation (UI 002 research D25): the kind of the field (`size`
 * formats `inUse`, `value`, `min`, `max` and `factor` as sizes) and its labels (for the `field` of
 * `mustNotExceed` and the `attributes` of `attribute-not-permitted`).
 */
export interface MessageContext {
  kind?: 'size' | 'count'
  labelFor?: (name: string) => string
}

/** Extension members as display strings: numbers formatted, string lists joined with labels. */
function extensionParams(
  problem: ApiProblem,
  tr: MessageTranslator,
  context: MessageContext,
): Record<string, string> {
  const locale = localeOf(tr)
  const named: Record<string, string> = {}
  for (const [key, value] of Object.entries(problem.extensions)) {
    if (typeof value === 'number') named[key] = formatNumber(value, locale)
    else if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      const items = value.map((item) => context.labelFor?.(item) ?? item)
      named[key] = formatList(items, locale)
    }
  }
  return named
}

export function problemMessage(
  problem: ApiProblem,
  tr: MessageTranslator,
  context: MessageContext = {},
): string {
  const key = problemMessageKey(problem, tr.te)
  const named = extensionParams(problem, tr, context)
  return Object.keys(named).length > 0 ? tr.t(key, named) : tr.t(key)
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
  context: MessageContext = {},
): Record<string, string> {
  const locale = localeOf(tr)
  const params = (violation.params ?? {}) as Record<string, unknown>
  const named: Record<string, string> = {}
  const size = (value: number, exact: boolean) => formatBytes(value, locale, { exact })
  const bytesMax = params.unit === 'bytes'
  for (const key of ['min', 'max', 'value', 'inUse'] as const) {
    const value = params[key]
    if (typeof value !== 'number') continue
    if (context.kind === 'size') named[key] = size(value, key !== 'inUse')
    else if (key === 'max' && bytesMax) named[key] = size(value, true)
    else named[key] = formatNumber(value, locale)
  }
  if (typeof params.factor === 'number') named.factor = size(params.factor, true)
  if (typeof params.field === 'string') {
    named.field = context.labelFor?.(params.field) ?? params.field
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

export function violationMessage(
  violation: FieldViolation,
  tr: MessageTranslator,
  context: MessageContext = {},
): string {
  const key = violationMessageKey(violation, tr.te)
  if (key === 'validation.invalid') return tr.t(key)
  if (key === 'validation.tooLong' && violation.params?.unit === 'bytes') {
    return tr.t('validation.tooLongBytes', violationParams(violation, tr, context))
  }
  return tr.t(key, violationParams(violation, tr, context))
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
    problemMessage: (problem: ApiProblem, context?: MessageContext) =>
      problemMessage(problem, tr(), context),
    /** One argument, so that it can be passed to `Array.map` (UI 001 call sites). */
    violationMessage: (violation: FieldViolation) => violationMessage(violation, tr()),
    /** With the field's context: sizes and field labels (UI 002). */
    violationMessageIn: (violation: FieldViolation, context: MessageContext) =>
      violationMessage(violation, tr(), context),
  }
}

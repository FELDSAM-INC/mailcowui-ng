// Translated messages for API problems and field violations (FR-075–FR-077, research R15). The
// app never shows the API's English `title`, `detail` or `message`. Problems are keyed by the last
// path segment of their type, so no list of types is written by hand (constitution I). A key that
// the classic interface has a message for resolves to mailcow's own text (`./legacy-messages`,
// constitution IV 1.3.0): the translator's `t` and `te` are those of `useText()`.
import { useI18n } from 'vue-i18n'

import type { ApiProblem, FieldViolation } from '@/api'

import { formatBytes, formatList, formatNumber } from './format'
import { hasMessage, text } from './index'
import { hasLegacy, lt, type LegacyKey } from './legacy'
import { isAppLocale, DEFAULT_LOCALE, type AppLocale } from './locales'

export interface MessageTranslator {
  t: (key: string, named?: Record<string, unknown>) => string
  te: (key: string) => boolean
  locale: string
}

/**
 * UI 004: extension members whose value selects a more specific message (research R17). UI 006:
 * `dependency` names the unavailable service of a `temporary-failure`.
 */
const PROBLEM_DISCRIMINATORS = ['holder', 'existingKind', 'dependency'] as const

/** UI 006: extension members that are sizes in bytes, per problem name (research R24). */
const SIZE_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  'quarantine-message-too-large': ['size', 'limit'],
}

/**
 * `problem.<name>.<member>.<value>` for a discriminating extension member (UI 004), then
 * `problem.<name>`, then `problem.status.<status>`, then `problem.generic`.
 */
export function problemMessageKey(problem: ApiProblem, te: (key: string) => boolean): string {
  if (problem.kind === 'network') return 'problem.network'
  if (problem.kind === 'unavailable') return 'problem.service-unavailable'
  const name = problem.problemName
  if (name) {
    for (const member of PROBLEM_DISCRIMINATORS) {
      const value = problem.extensions[member]
      if (typeof value !== 'string') continue
      // UI 006: `problem.byParam.<name>.<member>.<value>` where `problem.<name>` is itself a text.
      for (const key of [
        `problem.${name}.${member}.${value}`,
        `problem.byParam.${name}.${member}.${value}`,
      ]) {
        if (te(key)) return key
      }
    }
  }
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
  /** UI 004 (research R17): the form's own message namespace, for example `aliases.form`. */
  formKey?: string
  /** UI 004: the violation's path as the API names it, for example `destinations.2`. */
  path?: string
  /** UI 004: the value the form sent at a path, for `{entry}` and legacy placeholders. */
  valueAt?: (path: string) => string | undefined
  /** UI 004: values for placeholders that the problem does not carry, such as an `address`. */
  params?: Record<string, string>
}

/**
 * UI 004: the classic interface's label of a permission flag (`aliasExternalGoto` →
 * `acl.alias_external_goto`), or the flag's name when the installation has none.
 */
export function flagLabel(flag: string): string {
  const key = `acl.${flag.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`
  return hasLegacy(key) ? lt(key as LegacyKey) : flag
}

/**
 * Extension members as display strings: numbers formatted, strings as they are, string lists
 * joined with labels (`requiredFlags` with the classic flag labels); the caller's `params` fill what
 * the problem does not carry.
 */
export function extensionParams(
  problem: ApiProblem,
  tr: MessageTranslator,
  context: MessageContext = {},
): Record<string, string> {
  const locale = localeOf(tr)
  const named: Record<string, string> = { ...context.params }
  const sizes = SIZE_MEMBERS[problem.problemName ?? ''] ?? []
  // UI 006: `requiredFlagsMatch: any` means any one of the flags suffices ("or").
  const flagJoin = problem.extensions.requiredFlagsMatch === 'any' ? 'disjunction' : 'conjunction'
  for (const [key, value] of Object.entries(problem.extensions)) {
    if (typeof value === 'number') {
      named[key] = sizes.includes(key) ? formatBytes(value, locale) : formatNumber(value, locale)
    } else if (typeof value === 'string') named[key] = value
    else if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      const label =
        key === 'requiredFlags' ? flagLabel : (item: string) => context.labelFor?.(item) ?? item
      named[key] = formatList(
        value.map(label),
        locale,
        key === 'requiredFlags' ? flagJoin : 'conjunction',
      )
    }
  }
  // UI 006: a refused release names the mail server's answer as "<code> <answer>", as the
  // classic `danger.release_send_failed` shows the mailer's error.
  const { smtpCode, smtpResponse } = problem.extensions
  if (typeof smtpCode === 'number' && typeof smtpResponse === 'string') {
    named.smtpAnswer ??= `${smtpCode} ${smtpResponse}`
  }
  return named
}

export function problemMessage(
  problem: ApiProblem,
  tr: MessageTranslator,
  context: MessageContext = {},
): string {
  const key = problemMessageKey(problem, tr.te)
  // UI 005 (research R6, FR-020): a temporary failure names the service that is unavailable, when
  // it is one the self-service operations name; any other keeps the generic message.
  const dependency = problem.is('temporary-failure') ? problem.dependency : null
  const label = dependency ? `selfService.dependency.${dependency}` : null
  if (
    key === 'problem.temporary-failure' &&
    label &&
    tr.te(label) &&
    tr.te('problem.dependency-unavailable')
  ) {
    return tr.t('problem.dependency-unavailable', { service: tr.t(label) })
  }
  const named = extensionParams(problem, tr, context)
  return Object.keys(named).length > 0 ? tr.t(key, named) : tr.t(key)
}

/** UI 004 (research R17): the parameters whose value selects a more specific message. */
/** UI 009 (research R19): `because` (a username `required` because of a password). */
const DISCRIMINATING_PARAMS = [
  'kind',
  'unit',
  'field',
  'format',
  'resource',
  'reason',
  'because',
] as const

/** The field of a violation path, without entry indices: `destinations.2` → `destinations`. */
export function fieldOfPath(path: string): string {
  return path
    .split('.')
    .filter((part) => !/^\d+$/.test(part))
    .join('.')
}

/**
 * The message key of a violation (research R17): with a form context,
 * `<formKey>.errors.<field>.<code>.<param>.<value>`, then `<formKey>.errors.<field>.<code>`; then
 * `validation.format.<format>` for `invalidFormat`, `validation.byParam.<code>.<param>.<value>`,
 * `validation.<code>` and `validation.invalid`.
 */
export function violationMessageKey(
  violation: FieldViolation,
  te: (key: string) => boolean,
  context: Pick<MessageContext, 'formKey' | 'path'> = {},
): string {
  const code = String(violation.code)
  const params = (violation.params ?? {}) as Record<string, unknown>
  const variants = DISCRIMINATING_PARAMS.filter((param) => typeof params[param] === 'string').map(
    (param) => `${param}.${String(params[param])}`,
  )
  if (context.formKey && context.path) {
    const base = `${context.formKey}.errors.${fieldOfPath(context.path)}.${code}`
    for (const variant of variants) if (te(`${base}.${variant}`)) return `${base}.${variant}`
    if (te(base)) return base
  }
  for (const variant of variants) {
    if (te(`validation.byParam.${code}.${variant}`)) return `validation.byParam.${code}.${variant}`
  }
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
  // UI 013: keep the authoritative measured contrast and reference in colour refusals.
  if (violation.code === 'insufficientContrast') {
    for (const key of ['ratio', 'minimum'] as const) {
      if (typeof params[key] === 'number') named[key] = formatNumber(params[key], locale)
    }
    if (typeof params.surface === 'string') named.surface = params.surface
  }
  // UI 006: a fractional factor (0.1, the spam score step) is a number, not a size.
  if (typeof params.factor === 'number') {
    named.factor =
      params.factor < 1 ? formatNumber(params.factor, locale) : size(params.factor, true)
  }
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
  // UI 006: the template line of `invalidTemplate`.
  if (typeof params.line === 'number') named.line = formatNumber(params.line, locale)
  // UI 008: the refused option and token of a custom parameter (`optionNotAllowed`,
  // `optionContainsSpace`), shown as the API names them.
  for (const key of ['option', 'token'] as const) {
    if (typeof params[key] === 'string') named[key] = params[key]
  }
  // UI 005: the Sieve parser's message and line, and the hash scheme of a pre-hashed password.
  for (const key of ['message', 'scheme'] as const) {
    if (typeof params[key] === 'string') named[key] = params[key]
  }
  if (typeof params.line === 'number') named.line = formatNumber(params.line, locale)
  // UI 004: the entry the violation names, its domain part, and the form's other values.
  const entry = context.path ? context.valueAt?.(context.path) : undefined
  if (entry !== undefined) {
    named.entry = entry
    named.entryDomain = entry.includes('@') ? entry.slice(entry.lastIndexOf('@') + 1) : entry
  }
  for (const [key, value] of Object.entries(context.params ?? {})) named[key] ??= value
  if (context.valueAt) {
    for (const key of ['targetDomain', 'address', 'domain'] as const) {
      const value = context.valueAt(key)
      if (value !== undefined) named[key] ??= value
    }
  }
  return named
}

export function violationMessage(
  violation: FieldViolation,
  tr: MessageTranslator,
  context: MessageContext = {},
): string {
  const key = violationMessageKey(violation, tr.te, context)
  if (key === 'validation.invalid') return tr.t(key)
  if (key === 'validation.tooLong' && violation.params?.unit === 'bytes') {
    return tr.t('validation.tooLongBytes', violationParams(violation, tr, context))
  }
  // UI 005: a name whose stored form (special characters encoded) is too long.
  if (key === 'validation.tooLong' && violation.params?.stored === true) {
    return tr.t('validation.tooLongStored', violationParams(violation, tr, context))
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

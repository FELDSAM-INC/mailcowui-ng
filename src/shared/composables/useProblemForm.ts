// Form errors from API problems and client checks (FR-075–FR-078, research R15, R20). Field
// errors are mapped to fields by their dot path (`allowedNetworks.2` is the third network). With
// more than one error a summary links to each field and receives focus; with one, the field gets
// focus. Problems without field errors become the form's message. Everything is announced.
import { computed, nextTick, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem, FieldViolation } from '@/api'
import { useProblemMessages } from '@/i18n/problems'

import { announce } from './useAnnouncer'

export interface SummaryItem {
  path: string
  fieldId: string
  messages: string[]
}

export interface ProblemFormOptions {
  /** The element ID of the control for a field path, or null when the form has no such field. */
  fieldId: (path: string) => string | null
  /** UI 002: the kind of a field, so that sizes in rule parameters are shown as sizes. */
  fieldKind?: (path: string) => 'size' | 'count' | undefined
  /** UI 002: the translated label of a field, for `mustNotExceed` and named attributes. */
  labelFor?: (field: string) => string
  /**
   * UI 002: problem types shown on a field, for example `domain-exists` on `name`: the problem's
   * message becomes that field's error.
   */
  problemFields?: Record<string, string>
  /** UI 004 (research R17): the form's own message namespace, for example `aliases.form`. */
  formKey?: string
  /** UI 004: the value sent at a path (`destinations.2`), for `{entry}` and legacy placeholders. */
  valueAt?: (path: string) => string | undefined
  /** UI 004: placeholders a problem does not carry, for example the alias address. */
  problemParams?: () => Record<string, string>
}

let counter = 0

export function useProblemForm(options: ProblemFormOptions) {
  const { t } = useI18n()
  const { problemMessage, violationMessageIn } = useProblemMessages()
  const summaryId = `error-summary-${++counter}`

  const problem = shallowRef<ApiProblem | null>(null)
  /** Client-side errors: field path to message keys. */
  const clientErrors = shallowRef<Record<string, string[]>>({})
  /** UI 002: client errors as already translated messages (with their parameters filled in). */
  const clientMessages = shallowRef<Record<string, string[]>>({})

  const errors = computed(() => {
    const map = new Map<string, string[]>()
    for (const [path, messages] of Object.entries(clientMessages.value)) {
      if (messages.length > 0) map.set(path, [...messages])
    }
    for (const [path, keys] of Object.entries(clientErrors.value)) {
      if (keys.length > 0)
        map.set(
          path,
          keys.map((key) => t(key)),
        )
    }
    for (const [path, violations] of problem.value?.fieldErrors ?? []) {
      if (options.fieldId(path) === null) continue
      const context = {
        kind: options.fieldKind?.(path),
        labelFor: options.labelFor,
        formKey: options.formKey,
        path,
        valueAt: options.valueAt,
      }
      map.set(path, [
        ...(map.get(path) ?? []),
        ...violations.map((v: FieldViolation) => violationMessageIn(v, context)),
      ])
    }
    const mapped = mappedField(problem.value)
    if (mapped && problem.value) {
      map.set(mapped, [
        ...(map.get(mapped) ?? []),
        problemMessage(problem.value, { params: options.problemParams?.() }),
      ])
    }
    return map
  })

  /** The field a problem type is shown on, when the form has it. */
  function mappedField(current: ApiProblem | null): string | null {
    const name = current?.problemName
    const path = name ? options.problemFields?.[name] : undefined
    return path && options.fieldId(path) !== null ? path : null
  }

  const summary = computed<SummaryItem[]>(() =>
    [...errors.value].flatMap(([path, messages]) => {
      const fieldId = options.fieldId(path)
      return fieldId ? [{ path, fieldId, messages }] : []
    }),
  )

  /** A problem that is not about a field of this form (shown with ProblemMessage). */
  const formProblem = computed<ApiProblem | null>(() => {
    const current = problem.value
    if (!current) return null
    if (mappedField(current)) return null
    const mapped = [...current.fieldErrors.keys()].some((path) => options.fieldId(path) !== null)
    return mapped ? null : current
  })

  function errorsFor(path: string): string[] {
    return errors.value.get(path) ?? []
  }

  async function focusAndAnnounce() {
    await nextTick()
    const items = summary.value
    if (items.length > 1) {
      document.getElementById(summaryId)?.focus()
      announce(t('forms.errorSummary.title'), { assertive: true })
    } else if (items.length === 1) {
      const item = items[0]!
      document.getElementById(item.fieldId)?.focus()
      announce(item.messages.join(' '), { assertive: true })
    } else if (formProblem.value) {
      announce(problemMessage(formProblem.value), { assertive: true })
    }
  }

  function setProblem(next: ApiProblem | null): Promise<void> {
    problem.value = next
    return focusAndAnnounce()
  }

  function setClientErrors(next: Record<string, string[]>): Promise<void> {
    clientErrors.value = next
    problem.value = null
    return focusAndAnnounce()
  }

  function setClientMessages(next: Record<string, string[]>): Promise<void> {
    clientMessages.value = next
    clientErrors.value = {}
    problem.value = null
    return focusAndAnnounce()
  }

  function clear() {
    problem.value = null
    clientErrors.value = {}
    clientMessages.value = {}
  }

  return {
    summaryId,
    problem,
    summary,
    formProblem,
    hasErrors: computed(() => summary.value.length > 0 || formProblem.value !== null),
    errorsFor,
    setProblem,
    setClientErrors,
    setClientMessages,
    clear,
  }
}

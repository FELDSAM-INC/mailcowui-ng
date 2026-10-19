// An entry's edit page (research R6, conventions "Editing and conflicts", FR-011 to FR-014): the
// form opened from the entry as read; Save sends only the changed members with `If-Match`; a 412
// keeps the input, reloads the entry and lists the fields that changed meanwhile with their new
// saved values ("Save again" uses the reloaded version, "Discard my changes" takes its values); a
// 422 shows field errors through the form-context lookup (legacy messages); a 409 is shown on its
// field; a refused save keeps every value except passwords (`afterAttempt`). The save is passed
// in: password forms call the client directly, so no password reaches a mutation cache (R7).
import { computed, ref, shallowRef, watch, type Ref } from 'vue'

import { problemOf, type ApiProblem } from '@/api'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'

import { valueText } from '../logic/changed-fields'

export interface EntryFormSpec<T extends { etag: string }, F> {
  entry: () => T | undefined
  refetch: () => Promise<T | undefined>
  toForm: (entry: T) => F
  /** The user's changes against the version the form was opened with. */
  makePatch: (opened: T, form: F) => Record<string, unknown>
  send: (patch: Record<string, unknown>, ifMatch: string) => Promise<T>
  /** The fields listed after a 412 when their saved value changed. */
  outdatedFields: readonly (keyof T & string)[]
  fieldLabel: (field: string) => string
  fieldValue?: (field: string, value: unknown) => string
  fieldId: (path: string) => string | null
  formKey: string
  valueAt?: (path: string) => string | undefined
  /** Translated client checks before sending, by field. */
  validate?: (form: F) => Record<string, string[]>
  /** A conflict shown on a field (409), or null for the generic message. */
  conflict?: (problem: ApiProblem, form: F) => Record<string, string[]> | null
  onSaved: (saved: T) => void | Promise<void>
  /** Runs after every attempt: clears the typed password. */
  afterAttempt?: (form: F) => void
}

export function useEntryForm<T extends { etag: string }, F>(spec: EntryFormSpec<T, F>) {
  const base = shallowRef<T | null>(null)
  const opened = shallowRef<T | null>(null)
  const values = ref(null) as Ref<F | null>
  const problem = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)
  const outdatedFields = shallowRef<{ field: string; savedValue: unknown }[] | null>(null)

  const form = useProblemForm({
    fieldId: spec.fieldId,
    labelFor: spec.fieldLabel,
    formKey: spec.formKey,
    valueAt: spec.valueAt,
  })

  const versioned = useVersionedSave<T>({
    current: () => base.value,
    refetch: spec.refetch,
  })

  function open(entry: T) {
    base.value = entry
    opened.value = entry
    values.value = spec.toForm(entry)
    outdatedFields.value = null
    problem.value = null
    form.clear()
    versioned.discard()
  }

  const dirty = computed(
    () =>
      !!opened.value &&
      !!values.value &&
      Object.keys(spec.makePatch(opened.value, values.value)).length > 0,
  )

  // The form opens with the first version read and follows later reads while it is unchanged.
  watch(
    spec.entry,
    (entry) => {
      if (!entry) return
      if (!values.value || !dirty.value) open(entry)
    },
    { immediate: true },
  )

  async function send(): Promise<'saved' | 'unchanged' | 'other'> {
    const from = base.value
    if (!from || !values.value || pending.value) return 'other'
    const patch = spec.makePatch(opened.value ?? from, values.value)
    if (Object.keys(patch).length === 0) return 'unchanged'
    pending.value = true
    problem.value = null
    form.clear()
    try {
      const result = await versioned.save(patch, (body, ifMatch) => spec.send(body, ifMatch))
      if (result.status === 'saved') {
        open(result.result)
        await spec.onSaved(result.result)
        return 'saved'
      }
      if (result.status === 'outdated') {
        outdatedFields.value = changedSince(
          from as Record<string, unknown>,
          (result.latest ?? from) as Record<string, unknown>,
          spec.outdatedFields,
        )
        return 'other'
      }
      if (result.status === 'cancelled') return 'other'
      const failure = problemOf(result.problem)!
      const onField = spec.conflict?.(failure, values.value)
      if (onField) {
        await form.setClientMessages(onField)
        return 'other'
      }
      // A gone entry shows "not found"; every other refusal is announced with the form.
      if (failure.status === 404) problem.value = failure
      else await form.setProblem(failure)
      return 'other'
    } finally {
      pending.value = false
      if (values.value) spec.afterAttempt?.(values.value)
    }
  }

  async function save() {
    if (!values.value) return 'other'
    const errors = spec.validate?.(values.value) ?? {}
    if (Object.keys(errors).length > 0) {
      await form.setClientMessages(errors)
      return 'other'
    }
    return send()
  }

  /** "Save again" after a 412: the reloaded version becomes the base, the user's changes stay. */
  async function saveAgain() {
    const latest = versioned.latest.value
    if (latest) base.value = latest
    outdatedFields.value = null
    return send()
  }

  /** "Discard my changes" after a 412: the reloaded values replace the input. */
  function discard() {
    const latest = versioned.discard() ?? base.value
    if (latest) open(latest)
  }

  return {
    base,
    values,
    problem,
    pending,
    dirty,
    form,
    outdated: computed(
      () =>
        outdatedFields.value?.map((item) => ({
          field: item.field,
          label: spec.fieldLabel(item.field),
          saved: spec.fieldValue?.(item.field, item.savedValue) ?? valueText(item.savedValue),
        })) ?? null,
    ),
    save,
    saveAgain,
    discard,
  }
}

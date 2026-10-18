// Editing a template on its page (UI 002 FR-051, FR-054), one form as the classic edit page has
// (owner rule 1:1). The form is opened with the template it was read from (`base`); Save sends the
// changed members only, with `If-Match`. A 412 keeps the input, reloads the template and lists the
// fields that changed in the meantime with their new saved values ("Save again" or "Discard"); a
// 422 shows field errors; a duplicate name shows the classic "Template … already exists" on the
// name; a template that is gone, and other failures, are explained with nothing saved.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { lt } from '@/i18n'
import type { ApiProblem, DomainCapabilities, DomainTemplate, DomainTemplatePatch } from '@/api'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'

import { problemOf } from '../api'
import { SIZE_FIELDS } from '../field-labels'
import { useDomainFormat } from '../format'
import { buildPatch, TEMPLATE_READ_ONLY } from '../patch'
import { useFieldDisplay } from '../section-format'
import {
  TEMPLATE_FIELDS,
  templateFormValues,
  templateValues,
  validateTemplate,
  type TemplateField,
  type TemplateFormValues,
} from '../template-form'
import { formFieldIds, formLabel } from '../form-labels'
import { templateOptions, updateTemplate } from '../templates-api'
import { useClientErrors } from './useClientErrors'

export function useTemplateEditForm(options: {
  template: () => DomainTemplate | undefined
  capabilities: () => DomainCapabilities | undefined
  idPrefix: string
}) {
  const queryClient = useQueryClient()
  const format = useDomainFormat()
  const display = useFieldDisplay()
  const translate = useClientErrors()
  const ids = formFieldIds(options.idPrefix)

  /** The version whose tag a save sends: the one read, or the reloaded one after a 412. */
  const base = shallowRef<DomainTemplate | null>(null)
  /** The version the form was opened with; the patch holds the user's changes against it. */
  const opened = shallowRef<DomainTemplate | null>(null)
  const values = ref<TemplateFormValues | null>(null) as Ref<TemplateFormValues | null>
  const problem = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)
  const outdatedFields = shallowRef<{ field: TemplateField; savedValue: unknown }[] | null>(null)

  const form = useProblemForm({
    fieldId: (path) => ids[path] ?? ids[path.split('.')[0] ?? ''] ?? null,
    fieldKind: (path) => (SIZE_FIELDS.has(path) ? 'size' : undefined),
    labelFor: (field) => formLabel('templateEdit', field),
  })

  const versioned = useVersionedSave<DomainTemplate>({
    current: () => base.value,
    refetch: () => {
      const id = base.value?.id ?? options.template()?.id ?? 0
      return queryClient.fetchQuery({ ...templateOptions(queryClient, id), staleTime: 0 })
    },
  })

  function open(template: DomainTemplate) {
    base.value = template
    opened.value = template
    values.value = templateFormValues(template)
    outdatedFields.value = null
    problem.value = null
    form.clear()
    versioned.discard()
  }

  const dirty = computed(
    () =>
      !!base.value &&
      !!values.value &&
      JSON.stringify(values.value) !==
        JSON.stringify(templateFormValues(opened.value ?? base.value)),
  )

  // The form opens with the first version read, and follows later reads while it is unchanged.
  watch(
    options.template,
    (template) => {
      if (!template) return
      if (!values.value || !dirty.value) open(template)
    },
    { immediate: true },
  )

  /** The user's changes only, so that "Save again" never sends back a value changed elsewhere. */
  function makePatch(): DomainTemplatePatch {
    const from = opened.value!
    return buildPatch(
      from,
      { ...from, ...templateValues(values.value!) },
      TEMPLATE_FIELDS,
      {},
      TEMPLATE_READ_ONLY,
    ) as DomainTemplatePatch
  }

  async function send(): Promise<'saved' | 'unchanged' | 'other'> {
    const from = base.value
    if (!from || !values.value || pending.value) return 'other'
    const patch = makePatch()
    if (Object.keys(patch).length === 0) return 'unchanged'
    pending.value = true
    problem.value = null
    form.clear()
    try {
      const result = await versioned.save(patch, (body, ifMatch) =>
        updateTemplate(queryClient, from.id, body, ifMatch),
      )
      if (result.status === 'saved') {
        open(result.result)
        announce(lt('success.template_modified', result.result.name))
        return 'saved'
      }
      if (result.status === 'outdated') {
        outdatedFields.value = changedSince(from, result.latest ?? from, TEMPLATE_FIELDS)
        return 'other'
      }
      if (result.status === 'cancelled') return 'other'
      const failure = problemOf(result.problem)!
      if (failure.is('domain-template-name-exists')) {
        await form.setClientMessages({
          name: [lt('danger.template_exists', values.value.name.trim())],
        })
        return 'other'
      }
      if (failure.status === 422) {
        await form.setProblem(failure)
        return 'other'
      }
      problem.value = failure
      return 'other'
    } finally {
      pending.value = false
    }
  }

  async function save() {
    const from = base.value
    const capabilities = options.capabilities()
    if (!from || !values.value) return 'other'
    const errors = capabilities
      ? validateTemplate(values.value, capabilities, format, from.tags)
      : {}
    if (Object.keys(errors).length > 0) {
      await form.setClientMessages(translate(errors))
      return 'other'
    }
    return send()
  }

  /** "Save again" after a 412: the reloaded version becomes the base. */
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
          label: formLabel('templateEdit', item.field),
          saved: display.value(item.field, item.savedValue),
        })) ?? null,
    ),
    errorsFor: (path: string) => form.errorsFor(path),
    save,
    saveAgain,
    discard,
  }
}

// Editing a mailbox template on its page (FR-059, FR-061), one form as the classic edit page has
// (owner rule 1:1). The form is opened with the template it was read from; Save sends only the
// members the user changed, with `If-Match`. A 412 keeps the input, reloads the template and lists
// the fields that changed in the meantime with their new saved values ("Save again" or "Discard");
// a duplicate name shows legacy's "Template … already exists" on the name; a 422 shows field
// errors; a template that is gone, and other failures, are explained with nothing saved.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch, type Ref } from 'vue'

import { problemOf, type ApiProblem } from '@/api'
import { lt } from '@/i18n'
import { announce } from '@/shared/composables/useAnnouncer'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'
import type { ClientErrors } from '@/shared/validation/client-errors'

import { templatePatch, valuesFrom, type MailboxValues } from '../form-values'
import { mailboxProblem } from '../problems'
import { templateOptions, updateTemplate } from '../templates-api'
import type { MailboxTemplate } from '../types'
import { useTemplateDisplay } from './display'
import {
  checkTemplate,
  TEMPLATE_FIELDS,
  templateFieldId,
  type TemplateField,
} from './template-form'

export function useTemplateEditForm(options: {
  template: () => MailboxTemplate | undefined
  idPrefix: string
}) {
  const queryClient = useQueryClient()
  const display = useTemplateDisplay()
  const translate = useClientErrors()

  /** The version whose tag a save sends: the one read, or the reloaded one after a 412. */
  const base = shallowRef<MailboxTemplate | null>(null)
  /** The version the form was opened with; the patch holds the user's changes against it. */
  const opened = shallowRef<MailboxTemplate | null>(null)
  const name = ref('')
  const values = ref<MailboxValues | null>(null) as Ref<MailboxValues | null>
  const problem = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)
  const outdatedFields = shallowRef<{ field: TemplateField; savedValue: unknown }[] | null>(null)

  const form = useProblemForm({
    fieldId: (path) => templateFieldId(options.idPrefix, path),
    fieldKind: (path) => (path === 'quota' ? 'size' : undefined),
    labelFor: (field) => display.label(field),
  })

  const versioned = useVersionedSave<MailboxTemplate>({
    current: () => base.value,
    refetch: () => {
      const id = base.value?.id ?? options.template()?.id ?? 0
      return queryClient.fetchQuery({ ...templateOptions(queryClient, id), staleTime: 0 })
    },
  })

  function open(template: MailboxTemplate) {
    base.value = template
    opened.value = template
    name.value = template.name
    values.value = valuesFrom(template)
    outdatedFields.value = null
    problem.value = null
    form.clear()
    versioned.discard()
  }

  const dirty = computed(() => {
    const from = opened.value
    if (!from || !values.value) return false
    return (
      name.value !== from.name || JSON.stringify(values.value) !== JSON.stringify(valuesFrom(from))
    )
  })

  // The form opens with the first version read, and follows later reads while it is unchanged.
  watch(
    options.template,
    (template) => {
      if (!template) return
      if (!values.value || !dirty.value) open(template)
    },
    { immediate: true },
  )

  async function showFailure(failure: ApiProblem) {
    const view = mailboxProblem(failure, { templateName: name.value.trim() })
    const fields: ClientErrors = view.fields
    if (Object.keys(fields).length > 0) await form.setClientMessages(translate(fields))
    if (view.rest?.status === 422 && view.rest.fieldErrors.size > 0) {
      await form.setProblem(view.rest)
    } else if (view.rest) {
      problem.value = view.rest
    }
  }

  async function send(): Promise<'saved' | 'unchanged' | 'other'> {
    const from = base.value
    const start = opened.value
    if (!from || !start || !values.value || pending.value) return 'other'
    const errors: ClientErrors = {}
    const checked = checkTemplate(errors, name.value, values.value)
    if (!checked) {
      await form.setClientMessages(translate(errors))
      return 'other'
    }
    const patch = templatePatch(start, name.value, values.value, checked)
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
      if (result.status === 'failed') await showFailure(problemOf(result.problem)!)
      return 'other'
    } finally {
      pending.value = false
    }
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
    name,
    values,
    problem,
    pending,
    dirty,
    form,
    outdated: computed(() => display.changes(outdatedFields.value)),
    errorsFor: (path: string) => form.errorsFor(path),
    save: send,
    saveAgain,
    discard,
  }
}

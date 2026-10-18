// The wiring every editable section of the mailbox page shares (research R6, data-model §7.1,
// FR-031 to FR-044), on UI 002's `EditableSection` and UI 001's `useVersionedSave`: the form opened
// from the mailbox when the page opens the section, its dirty state, the client rules, the save
// with `If-Match` and only the changed members, "Save again" and "Discard my changes" after an
// outdated save, and the inline status. Outcomes:
// - 200: the response becomes the base; the password is cleared; legacy's
//   `success.mailbox_modified` is shown and announced.
// - 412: the input is kept, the mailbox reloaded, the section's fields that changed listed with
//   their saved values; nothing is merged or retried.
// - 403 attribute-not-permitted: the refused fields turn read-only, with "Prohibited by ACL" and the
//   permission; the identity and the mailbox are reloaded (FR-043).
// - 422: field errors with legacy's messages where legacy has one (`problems.ts`).
// - 404 and other failures: a message, the input kept.
// A save that carries a password goes through `useSecretRequest` (never a mutation or cache).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch, type Ref } from 'vue'

import { ApiProblem, queryKeys, type Identity, type MailboxCapabilities } from '@/api'
import { lt, resolveText } from '@/i18n'
import { useI18n } from 'vue-i18n'
import type { SectionStatus } from '@/shared/components/editable-section'
import { announce } from '@/shared/composables/useAnnouncer'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'
import type { ClientErrors } from '@/shared/validation/client-errors'

import { fetchMailbox, updateMailbox, updateMailboxWithPassword } from '../api'
import { useMailboxFieldDisplay } from '../field-display'
import type { Patch, SectionField } from '../patch'
import { mailboxProblem } from '../problems'
import type { Mailbox } from '../types'

export interface MailboxSectionProps {
  mailbox: Mailbox
  editing?: boolean
  editDisabledReason?: string | null
  capabilities?: MailboxCapabilities
  identity?: Identity | null
}

export type MailboxSectionEmit = (
  event: 'edit' | 'close' | 'dirty' | 'saved',
  ...args: unknown[]
) => void

export interface MailboxSectionSpec<F> {
  id: string
  /** The patch members of the section. */
  fields: readonly SectionField[]
  toForm: (mailbox: Mailbox) => F
  /** The user's changes against the version the form was opened with. */
  makePatch: (opened: Mailbox, form: F, canEdit: (field: SectionField) => boolean) => Patch
  validate?: (form: F, base: Mailbox) => ClientErrors
  /** The element ID of a field's control, for focusing field errors. */
  fieldId?: (path: string) => string | null
}

export function useMailboxSection<F>(
  props: MailboxSectionProps,
  emit: MailboxSectionEmit,
  spec: MailboxSectionSpec<F>,
) {
  const queryClient = useQueryClient()
  const { t } = useI18n()
  const display = useMailboxFieldDisplay()
  const translate = useClientErrors()
  const base = shallowRef<Mailbox | null>(null)
  /** The version the form was opened with; the patch holds the user's changes against it. */
  let opened: Mailbox = props.mailbox
  const form = ref(spec.toForm(props.mailbox)) as Ref<F>
  const status = ref<SectionStatus | null>(null)
  const refused = ref(new Set<string>())
  const problem = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)
  const outdatedFields = shallowRef<{ field: string; savedValue: unknown }[] | null>(null)

  const problemForm = useProblemForm({
    fieldId: (path) => {
      const field = path.split('.')[0] ?? path
      if (!spec.fields.includes(field as SectionField) && !path.startsWith('attributes.')) {
        return null
      }
      return spec.fieldId?.(path) ?? `section-${spec.id}-${field}`
    },
    fieldKind: (path) => (path === 'quota' ? 'size' : undefined),
    labelFor: (field) => display.label(field),
  })

  const address = () => base.value?.address ?? props.mailbox.address

  const versioned = useVersionedSave<Mailbox>({
    current: () => base.value,
    refetch: async () => {
      const latest = await fetchMailbox(address())
      queryClient.setQueryData(queryKeys.mailboxes.detail(latest.address), latest)
      return latest
    },
  })
  const secret = useSecretRequest((target: string, body: Patch, ifMatch: string) =>
    updateMailboxWithPassword(queryClient, target, body, ifMatch),
  )

  const canEdit = (field: SectionField) => !refused.value.has(field)

  function setStatus(next: SectionStatus | null) {
    status.value = next
    if (next) announce(next.message)
  }

  watch(
    () => props.editing,
    (on) => {
      if (!on) return
      base.value = props.mailbox
      opened = props.mailbox
      form.value = spec.toForm(opened)
      outdatedFields.value = null
      refused.value = new Set()
      problem.value = null
      problemForm.clear()
      versioned.discard()
      setStatus(null)
    },
    { immediate: true },
  )

  const dirty = computed(
    () =>
      !!props.editing &&
      !!base.value &&
      JSON.stringify(form.value) !== JSON.stringify(spec.toForm(opened)),
  )
  watch(dirty, (value) => emit('dirty', value), { immediate: true })

  function send(body: Patch, ifMatch: string): Promise<Mailbox> {
    if ('password' in body) {
      return secret.run(address(), body, ifMatch).then((result) => {
        if (!result) {
          throw secret.problem.value ?? ApiProblem.fromParts({ kind: 'network', cause: null })
        }
        return result
      })
    }
    return updateMailbox(queryClient, address(), body, ifMatch)
  }

  async function showFailure(failure: ApiProblem) {
    const view = mailboxProblem(failure, { localPartField: 'localPart' })
    if (failure.is('attribute-not-permitted')) {
      const attributes = Array.isArray(failure.extensions.attributes)
        ? failure.extensions.attributes.map((path) => String(path).split('.')[0]!)
        : []
      refused.value = new Set([...refused.value, ...attributes])
    }
    await problemForm.setClientMessages(translate(view.fields))
    if (view.form) {
      setStatus({ kind: 'error', message: resolveText(view.form, t) })
    }
    if (view.rest) {
      if (view.rest.fieldErrors.size > 0) await problemForm.setProblem(view.rest)
      else problem.value = view.rest
    }
  }

  async function run(patch: Patch) {
    if (!base.value || pending.value) return
    for (const field of refused.value) delete (patch as Record<string, unknown>)[field]
    if (Object.keys(patch).length === 0) {
      emit('dirty', false)
      emit('close')
      return
    }
    pending.value = true
    problem.value = null
    problemForm.clear()
    setStatus(null)
    try {
      const result = await versioned.save(patch, send)
      if (result.status === 'saved') {
        base.value = result.result
        opened = result.result
        outdatedFields.value = null
        form.value = spec.toForm(result.result)
        setStatus({
          kind: 'success',
          message: lt('success.mailbox_modified', result.result.address),
        })
        emit('dirty', false)
        emit('saved', result.result)
        emit('close')
        return
      }
      if (result.status === 'outdated') {
        const latest = result.latest ?? base.value
        outdatedFields.value = changedSince(
          base.value as unknown as Record<string, unknown>,
          latest as unknown as Record<string, unknown>,
          spec.fields.filter((field) => field !== 'password'),
        )
        return
      }
      if (result.status === 'failed') await showFailure(result.problem)
    } finally {
      pending.value = false
    }
  }

  async function save() {
    const current = base.value
    if (!current) return
    const errors = spec.validate?.(form.value, current) ?? {}
    if (Object.keys(errors).length > 0) {
      await problemForm.setClientMessages(translate(errors))
      return
    }
    await run(spec.makePatch(opened, form.value, canEdit))
  }

  /** "Save again" after a 412: the reloaded version becomes the base; the user's changes stay. */
  async function saveAgain() {
    const latest = versioned.latest.value
    if (latest) base.value = latest
    outdatedFields.value = null
    await run(spec.makePatch(opened, form.value, canEdit))
  }

  /** "Discard my changes" after a 412: the form takes the reloaded values. */
  function discard() {
    const latest = versioned.discard() ?? base.value
    if (!latest) return
    base.value = latest
    opened = latest
    outdatedFields.value = null
    form.value = spec.toForm(latest)
  }

  return {
    form,
    base,
    status,
    problem,
    pending: computed(() => pending.value || secret.pending.value),
    dirty,
    canEdit,
    refused,
    problemForm,
    outdated: computed(() => display.changes(outdatedFields.value)),
    errorsFor: (path: string) => problemForm.errorsFor(path),
    save,
    saveAgain,
    discard,
    cancel: () => emit('close'),
  }
}

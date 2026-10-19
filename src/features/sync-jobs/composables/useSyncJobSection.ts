// The job page's section (UI 008 research R11, data-model §7 "Section edit", FR-026 to FR-028):
// the classic edit page's form opened from the job it was read from, with its own save.
// - Client checks first (FR-021); then only the changed fields are sent with that version.
// - 200: the saved job becomes the base; legacy's `success.mailbox_modified` (with the running
//   note for a running job, FR-038) stays in the section until the next action.
// - 412: the input is kept, the job is reloaded and the fields that changed in the meantime are
//   listed with their new values; "Save again" sends the user's changes against the reloaded version,
//   "Discard my changes" takes the reloaded values. Nothing is merged or sent on its own.
// - 422: field errors on their fields (the form's own messages, UI 004 R17); a refusal of custom
//   parameters refetches the capabilities.
// - 409 `sync-job-exists`: legacy's "Object host / user already exists" with a link (FR-023).
// - 404: the job is gone ("This sync job no longer exists.").
// The typed password lives in the form state only and is cleared on save, cancel and close.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  problemOf,
  queryKeys,
  type ApiProblem,
  type SyncJob,
  type SyncJobCapabilities,
} from '@/api'
import { lt, resolveText } from '@/i18n'
import { useFormat } from '@/i18n/format'
import { legacyRaw } from '@/i18n/legacy'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import { announce } from '@/shared/composables/useAnnouncer'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'

import { syncJobOptions, updateSyncJob } from '../api'
import { fieldLabel } from '../field-labels'
import { SYNC_JOB_FORM_KEY } from '../field-messages'
import {
  BOOLEAN_FIELDS,
  checkValues,
  FIELD_ORDER,
  patchFor,
  toFormValues,
  type FormField,
  type SyncJobFormValues,
} from '../form-model'

/** The fields a reload can change (the password is never returned). */
const COMPARED = FIELD_ORDER.filter((field) => field !== 'remotePassword')

/** A legacy value without its character references (`&#10003;` → ✓), for plain text. */
export function plainLegacy(value: string): string {
  return value.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

export interface SectionOptions {
  job: () => SyncJob
  editing: () => boolean
  caps: () => SyncJobCapabilities | undefined
  /** Closes the section (removes `edit` from the address). */
  close: () => void
  idPrefix: string
}

export function useSyncJobSection(options: SectionOptions) {
  const { t } = useI18n()
  const fmt = useFormat()
  const queryClient = useQueryClient()
  const clientMessages = useClientErrors()
  const base = shallowRef<SyncJob>(options.job())
  /** The version the form was opened with: the patch holds the user's changes against it. */
  const opened = shallowRef<SyncJob>(base.value)
  const form = ref(toFormValues(base.value)) as Ref<SyncJobFormValues>
  const status = ref<SectionStatus | null>(null)
  const outdated = shallowRef<SectionChange[] | null>(null)
  const existing = shallowRef<{ id: number; object: string } | null>(null)
  const gone = ref(false)
  const failure = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)

  const customParamsAllowed = computed(() => options.caps()?.customParameters.allowed ?? false)

  const problemForm = useProblemForm({
    fieldId: (path) => {
      const field = path.split('.')[0] as FormField
      return (FIELD_ORDER as readonly string[]).includes(field)
        ? `${options.idPrefix}-${field}`
        : null
    },
    formKey: SYNC_JOB_FORM_KEY,
    labelFor: (field) =>
      (FIELD_ORDER as readonly string[]).includes(field)
        ? resolveText(fieldLabel('edit', field as FormField), t)
        : field,
  })

  const versioned = useVersionedSave<SyncJob>({
    current: () => base.value,
    refetch: () =>
      queryClient.fetchQuery({ ...syncJobOptions(queryClient, base.value.id), staleTime: 0 }),
  })

  function reset(job: SyncJob) {
    base.value = job
    opened.value = job
    form.value = toFormValues(job)
    outdated.value = null
    existing.value = null
    gone.value = false
    failure.value = null
    problemForm.clear()
  }

  watch(
    options.editing,
    (on) => {
      if (!on) {
        form.value.remotePassword = ''
        return
      }
      versioned.discard()
      reset(options.job())
      status.value = null
    },
    { immediate: true },
  )

  const dirty = computed(
    () =>
      options.editing() &&
      !gone.value &&
      JSON.stringify(form.value) !== JSON.stringify(toFormValues(opened.value)),
  )

  function display(field: FormField, job: SyncJob): string {
    if ((BOOLEAN_FIELDS as readonly string[]).includes(field)) {
      return plainLegacy(
        legacyRaw(job[field as (typeof BOOLEAN_FIELDS)[number]] ? 'mailbox.yes' : 'mailbox.no'),
      )
    }
    if (field === 'encryption') return t(`enums.syncJobEncryption.${job.encryption}`)
    const value = job[field as keyof SyncJob]
    if (typeof value === 'number') return field === 'remotePort' ? String(value) : fmt.number(value)
    return value === '' ? '-' : typeof value === 'string' ? value : ''
  }

  function setStatus(next: SectionStatus | null) {
    status.value = next
    if (next) announce(next.message)
  }

  /** Sends the user's changes (against the opened version) with the version tag of `base`. */
  async function send(): Promise<void> {
    const against = base.value
    const caps = options.caps()
    if (!caps) return
    const errors = checkValues(
      form.value,
      caps,
      {
        mode: 'edit',
        needsMailbox: false,
        customParamsAllowed: customParamsAllowed.value,
      },
      (value) => fmt.number(value),
    )
    if (Object.keys(errors).length > 0) {
      await problemForm.setClientMessages(clientMessages(errors))
      return
    }
    const patch = patchFor(opened.value, form.value, {
      customParamsAllowed: customParamsAllowed.value,
    })
    if (Object.keys(patch).length === 0) {
      form.value.remotePassword = ''
      options.close()
      return
    }
    pending.value = true
    existing.value = null
    failure.value = null
    problemForm.clear()
    try {
      const result = await versioned.save(patch, (body, ifMatch) =>
        updateSyncJob(queryClient, against.id, body, ifMatch),
      )
      if (result.status === 'saved') {
        const saved = result.result
        const note = saved.runStatus.running ? t('syncJobs.running.note') : ''
        reset(saved)
        setStatus({
          kind: 'success',
          message: [lt('success.mailbox_modified', saved.mailbox), note].filter(Boolean).join(' '),
        })
        options.close()
        return
      }
      if (result.status === 'outdated') {
        const latest = result.latest ?? base.value
        outdated.value = changedSince(base.value, latest, COMPARED).map(({ field }) => ({
          field,
          label: resolveText(fieldLabel('edit', field), t)
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
          saved: display(field, latest),
        }))
        return
      }
      if (result.status === 'cancelled') return
      const problem = problemOf(result.problem)!
      if (problem.status === 404) {
        gone.value = true
        return
      }
      if (problem.is('sync-job-exists')) {
        const id = Number(problem.extensions.syncJobId)
        existing.value = {
          id,
          object: `${form.value.remoteHost.trim()} / ${form.value.remoteUser}`,
        }
        return
      }
      if (problem.status === 422) {
        const refused = problem.fieldErrors
          .get('customParameters')
          ?.some((violation) => String(violation.code) === 'customParamsNotPermitted')
        if (refused)
          void queryClient.invalidateQueries({ queryKey: queryKeys.syncJobs.capabilities() })
        await problemForm.setProblem(problem)
        return
      }
      failure.value = problem
    } finally {
      pending.value = false
    }
  }

  return {
    form,
    base,
    status,
    outdated,
    existing,
    gone,
    failure,
    pending,
    dirty,
    customParamsAllowed,
    problemForm,
    errorsFor: (path: string) => problemForm.errorsFor(path),
    save: () => send(),
    /** "Save again": the user's changes against the reloaded version. */
    saveAgain() {
      const latest = versioned.latest.value
      if (latest) base.value = latest
      outdated.value = null
      return send()
    },
    /** "Discard my changes": the reloaded values. */
    discard() {
      const latest = versioned.discard() ?? base.value
      reset(latest)
    },
    cancel() {
      form.value.remotePassword = ''
      options.close()
    },
  }
}

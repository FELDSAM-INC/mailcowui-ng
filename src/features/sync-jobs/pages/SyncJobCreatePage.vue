<script setup lang="ts">
// Adding a sync job (UI 008 US2, FR-016 to FR-028), mirroring the classic add modals
// `#addSyncJobModalAdmin` (administrators, domain administrators: the owner first, chosen with the
// shared `MailboxSearchPicker`) and `#addSyncJobModal` (mailbox users: no owner, their own mailbox)
// as one form in their order, with legacy's notice above it. The values start from the
// capabilities' defaults (FR-018), `?mailbox=` preselects the owner, client checks run before
// sending, server errors land on their fields, an existing job links to it (FR-023), and success
// opens the new job in place of the form (`router.replace`, so Back skips it) with legacy's
// message. Nothing typed is stored in the browser; leaving with input asks first.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { problemOf, queryKeys, type ApiProblem } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt, resolveText } from '@/i18n'
import { useFormat } from '@/i18n/format'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { buttonVariants } from '@/shared/ui/button'

import { createSyncJob, useSyncJobCapabilities } from '../api'
import SyncJobFormFields from '../components/SyncJobFormFields.vue'
import { fieldLabel, OWNER_LABEL } from '../field-labels'
import { SYNC_JOB_FORM_KEY } from '../field-messages'
import {
  checkValues,
  createBody,
  FIELD_ORDER,
  initialCreateValues,
  type FormField,
  type SyncJobFormValues,
} from '../form-model'
import { rememberOutcome } from '../outcome'

const { t } = useI18n()
const fmt = useFormat()
const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const identity = useIdentityQuery()
const role = computed(() => identity.data.value?.role ?? 'mailboxUser')
const manager = computed(() => role.value !== 'mailboxUser')
const capabilities = useSyncJobCapabilities()
const caps = computed(() => capabilities.data.value)
const customParamsAllowed = computed(() => caps.value?.customParameters.allowed ?? false)
const clientMessages = useClientErrors()

const ID_PREFIX = 'syncjob-create'
const preselected =
  typeof route.query.mailbox === 'string' && route.query.mailbox.length <= 255
    ? route.query.mailbox
    : ''
const form = ref<SyncJobFormValues | null>(null) as Ref<SyncJobFormValues | null>
let initial = ''
watch(
  caps,
  (value) => {
    if (!value || form.value) return
    form.value = initialCreateValues(value, { mailbox: manager.value ? preselected : '' })
    initial = JSON.stringify({ ...form.value, mailbox: '' })
  },
  { immediate: true },
)

const fields = new Set<string>(['mailbox', ...FIELD_ORDER])
const problemForm = useProblemForm({
  fieldId: (path) => {
    const field = path.split('.')[0] ?? ''
    if (!fields.has(field) || (field === 'mailbox' && !manager.value)) return null
    return `${ID_PREFIX}-${field}`
  },
  formKey: SYNC_JOB_FORM_KEY,
  labelFor: (field) =>
    field === 'mailbox'
      ? resolveText(OWNER_LABEL, t)
      : fields.has(field)
        ? resolveText(fieldLabel('create', field as FormField), t)
        : field,
})

const pending = ref(false)
const existing = ref<{ id: number; object: string } | null>(null)
const failure = ref<ApiProblem | null>(null)
const done = ref(false)

const dirty = computed(
  () =>
    !done.value &&
    !!form.value &&
    JSON.stringify({
      ...form.value,
      mailbox: form.value.mailbox === preselected ? '' : form.value.mailbox,
    }) !== initial,
)
const guard = useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })

async function submit(event: Event) {
  event.preventDefault()
  const values = form.value
  const current = caps.value
  if (!values || !current || pending.value) return
  existing.value = null
  failure.value = null
  const errors = checkValues(
    values,
    current,
    { mode: 'create', needsMailbox: manager.value, customParamsAllowed: customParamsAllowed.value },
    (value) => fmt.number(value),
  )
  if (Object.keys(errors).length > 0) {
    await problemForm.setClientMessages(clientMessages(errors))
    return
  }
  problemForm.clear()
  pending.value = true
  try {
    const job = await createSyncJob(
      queryClient,
      createBody(values, {
        sendMailbox: manager.value,
        customParamsAllowed: customParamsAllowed.value,
      }),
    )
    const message = lt('success.mailbox_modified', job.mailbox)
    done.value = true
    guard.disarm()
    values.remotePassword = ''
    rememberOutcome(job.id, message)
    announce(message)
    await router.replace({ name: 'sync-job-detail', params: { syncJobId: job.id } })
  } catch (error) {
    const problem = problemOf(error)!
    if (problem.is('sync-job-exists')) {
      existing.value = {
        id: Number(problem.extensions.syncJobId),
        object: `${values.remoteHost.trim()} / ${values.remoteUser}`,
      }
      announce(lt('danger.object_exists', existing.value.object), { assertive: true })
    } else if (problem.status === 422) {
      const refused = problem.fieldErrors
        .get('customParameters')
        ?.some((violation) => String(violation.code) === 'customParamsNotPermitted')
      if (refused) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.syncJobs.capabilities() })
      }
      await problemForm.setProblem(problem)
    } else if (problem.status === 404 && manager.value) {
      await problemForm.setClientMessages({ mailbox: [t('validation.notFound')] })
    } else {
      failure.value = problem
    }
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="lt('add.syncjob')" />
    <p class="text-gray-700 dark:text-gray-300">{{ lt('add.syncjob_hint') }}</p>

    <div v-if="capabilities.isPending.value" role="status" aria-busy="true">
      <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
    </div>
    <div v-else-if="!caps" class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('syncJobs.create.loadFailed') }}
      </p>
      <ProblemMessage
        :problem="problemOf(capabilities.error.value)"
        retry
        @retry="capabilities.refetch()"
      />
    </div>
    <form v-else-if="form" class="flex flex-col gap-4" novalidate @submit="submit">
      <ErrorSummary :id="problemForm.summaryId" :items="problemForm.summary.value" />
      <div
        v-if="existing"
        role="alert"
        class="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        <p class="wrap-anywhere">{{ lt('danger.object_exists', existing.object) }}</p>
        <RouterLink
          :to="{ name: 'sync-job-detail', params: { syncJobId: existing.id } }"
          class="font-medium underline underline-offset-2"
        >
          {{ t('syncJobs.form.openExisting') }}
        </RouterLink>
      </div>
      <ProblemMessage v-if="failure" :problem="failure" />
      <ProblemMessage
        v-if="problemForm.formProblem.value"
        :problem="problemForm.formProblem.value"
      />
      <SyncJobFormFields
        v-model:values="form"
        mode="create"
        :id-prefix="ID_PREFIX"
        :caps="caps"
        :role="role"
        :custom-params-allowed="customParamsAllowed"
        :errors-for="problemForm.errorsFor"
      >
        <template v-if="manager" #owner>
          <MailboxSearchPicker
            :id="`${ID_PREFIX}-mailbox`"
            :label="resolveText(OWNER_LABEL, t)"
            :placeholder="lt('add.select')"
            :model-value="form.mailbox || null"
            :errors="problemForm.errorsFor('mailbox')"
            required
            @update:model-value="
              (value) => form && (form.mailbox = typeof value === 'string' ? value : '')
            "
          />
        </template>
      </SyncJobFormFields>
      <div>
        <button type="submit" :class="buttonVariants({ variant: 'default' })" :disabled="pending">
          {{ lt('admin.add') }}
        </button>
      </div>
    </form>
  </section>
</template>

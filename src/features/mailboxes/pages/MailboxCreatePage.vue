<script setup lang="ts">
// Adding a mailbox (US2, FR-018 to FR-030), as the classic "Add mailbox" form #addMailboxModal
// (owner rule 1:1) on its own page: the username with the "@domain" suffix and the full name, the
// domain, the template (Default first; another template replaces the values without asking, as
// legacy), the password with "generate", the haveibeenpwned check and the policy, its repeat, then
// the mailbox values in legacy's order with "Add". The quota follows the chosen domain: legacy's
// "max." badge, "Please select a domain first" before one is chosen, and legacy's warning with the
// quota fixed at 0 when the domain has no quota left. Only values that differ from the template are
// sent, with the local part, domain, template, quota and password (FR-025); the request carries the
// password, so it goes through `useSecretRequest`. After the creation the mailbox page opens with
// legacy's `success.mailbox_added` and any failed follow-up step; errors stay on their fields with
// every entry kept (FR-027); leaving with entries asks first.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt, resolveText, type TextRef } from '@/i18n'
import DomainPicker, { type DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import TemplateSelect from '@/shared/components/TemplateSelect.vue'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { buttonVariants } from '@/shared/ui/button'
import type { ClientErrors } from '@/shared/validation/client-errors'
import { MAILBOX_DISPLAY_NAME_MAX } from '@/shared/validation/limits'

import { canSetUnlimited, gate } from '../acl'
import { createMailbox, domainOptions, domainPickerSource } from '../api'
import MailboxQuotaField from '../components/fields/MailboxQuotaField.vue'
import MailboxValueFields from '../components/fields/MailboxValueFields.vue'
import PasswordFields from '../components/fields/PasswordFields.vue'
import { useMailboxCapabilities } from '../composables/useMailboxCapabilities'
import { usePasswordPolicy } from '../composables/usePasswordPolicy'
import { checkCreate, createFieldId } from '../create-form'
import { creationFlashes } from '../creation-report'
import { useMailboxFieldDisplay } from '../field-display'
import { setMailboxFlash } from '../flash'
import { createRequest, valuesFrom, type MailboxValues, type TemplateSource } from '../form-values'
import { mailboxProblem } from '../problems'
import { prefillQuotaMib } from '../quota'
import { allTemplatesOptions } from '../templates-api'

const ID = 'mailbox-add'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useQueryClient()
const translate = useClientErrors()
const display = useMailboxFieldDisplay()
const identityQuery = useIdentityQuery()
const identity = computed(() => identityQuery.data.value ?? null)
const capabilitiesQuery = useMailboxCapabilities()
const capabilities = computed(() => capabilitiesQuery.data.value)
const policyQuery = usePasswordPolicy()
const policy = computed(() => policyQuery.data.value ?? null)
const templatesQuery = useQuery(
  computed(() => ({
    ...allTemplatesOptions(capabilities.value?.maxPageSize ?? 1000),
    enabled: !!capabilities.value,
  })),
)
const templates = computed(() => templatesQuery.data.value?.data ?? [])

// The essentials, in legacy's order.
const localPart = ref('')
const displayName = ref('')
const domain = ref<string | null>(
  typeof route.query.domain === 'string' ? route.query.domain : null,
)
const domainLabels = ref<Record<string, string>>({})
const templateId = ref<number | null>(null)
const password = ref('')
const password2 = ref('')
const values = ref<MailboxValues | null>(null)
onBeforeUnmount(() => {
  password.value = ''
  password2.value = ''
})

const domainQuery = useQuery(
  computed(() => ({ ...domainOptions(domain.value ?? ''), enabled: !!domain.value })),
)
const domainData = computed(() => (domain.value ? domainQuery.data.value : undefined))
const maxQuota = computed(() => domainData.value?.usage.maxNewMailboxQuota ?? null)
const exhausted = computed(() => maxQuota.value === 0)

const template = computed<TemplateSource | null>(() => {
  const chosen = templates.value.find((item) => item.id === templateId.value)
  return chosen ?? capabilities.value?.templateDefaults ?? null
})

function prefill() {
  if (!values.value || !template.value) return
  values.value = {
    ...values.value,
    quota: String(prefillQuotaMib(template.value.quota, maxQuota.value)),
  }
}

// Default first and applied; another template replaces the values, as legacy does.
watch(
  templates,
  (list) => {
    if (templateId.value === null && list.length > 0) templateId.value = list[0]!.id
  },
  { immediate: true },
)
watch(
  template,
  (source) => {
    if (!source) return
    values.value = valuesFrom(source)
    prefill()
  },
  { immediate: true },
)
watch(maxQuota, prefill)

let baseline = ''
watch(
  values,
  (value) => {
    if (value && baseline === '') baseline = JSON.stringify(value)
  },
  { immediate: true },
)
const entered = computed(
  () =>
    localPart.value !== '' ||
    displayName.value !== '' ||
    password.value !== '' ||
    (baseline !== '' && JSON.stringify(values.value) !== baseline),
)
const guard = useLeaveGuard(entered, { messageKey: 'leaveGuard.body' })

const gates = computed(() => ({
  protocolAccess: gate('protocolAccess', identity.value),
  webmailRedirect: gate('webmailRedirect', identity.value),
  rateLimit: gate('rateLimit', identity.value),
}))

const form = useProblemForm({
  fieldId: (path) => createFieldId(ID, path),
  fieldKind: (path) => (path === 'quota' ? 'size' : undefined),
  labelFor: (field) => display.label(field),
})

const secret = useSecretRequest(createMailbox)

async function submit() {
  if (!values.value || !template.value || secret.pending.value) return
  const errors: ClientErrors = {}
  const checked = checkCreate(
    errors,
    {
      localPart: localPart.value,
      displayName: displayName.value,
      domain: domain.value,
      password: password.value,
      password2: password2.value,
    },
    values.value,
    { maxQuota: maxQuota.value, unlimitedAllowed: canSetUnlimited(identity.value) },
  )
  if (!checked || !domain.value) {
    await form.setClientMessages(translate(errors))
    return
  }
  form.clear()
  const body = createRequest(
    {
      localPart: localPart.value,
      domain: domain.value,
      displayName: displayName.value,
      templateId: templateId.value ?? 0,
      password: password.value,
    },
    values.value,
    template.value,
    checked,
  )
  if (templateId.value === null) delete body.templateId
  const created = await secret.run(client, body)
  if (created) {
    guard.disarm()
    password.value = ''
    password2.value = ''
    setMailboxFlash(created.address, creationFlashes(created))
    await router.push({ name: 'mailbox-detail', params: { address: created.address } })
    return
  }
  const problem = secret.problem.value
  if (!problem) return
  if (problem.is('validation-failed') && problem.fieldErrors?.has('templateId')) {
    void templatesQuery.refetch()
  }
  if (problem.is('validation-failed') && problem.fieldErrors?.has('password')) {
    void policyQuery.refetch()
  }
  const view = mailboxProblem(problem)
  if (Object.keys(view.fields).length > 0) await form.setClientMessages(translate(view.fields))
  formMessage.value = view.form
  if (view.rest) await form.setProblem(view.rest)
}

/** A refusal legacy reports for the whole form (`danger.max_mailbox_exceeded`). */
const formMessage = ref<TextRef | null>(null)
watch(
  () => secret.pending.value,
  (pending) => {
    if (pending) formMessage.value = null
  },
)

const retryable = computed(() => {
  const problem = form.formProblem.value
  return !!problem && (problem.kind !== 'problem' || (problem.status ?? 0) >= 500)
})
const loading = computed(() => capabilitiesQuery.isPending.value || templatesQuery.isPending.value)
const loadProblem = computed(() => capabilitiesQuery.error.value ?? templatesQuery.error.value)

function remember(option: DomainPickerOption) {
  domainLabels.value = { ...domainLabels.value, [option.name]: option.nameUnicode }
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4">
    <PageHeader :title="lt('mailbox.add_mailbox')" />

    <div v-if="loading" data-page-loading role="status" aria-busy="true">
      <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
    </div>
    <div v-else-if="loadProblem || !values" class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('domainTemplates.create.loadFailed') }}
      </p>
      <ProblemMessage
        :problem="problemOf(loadProblem)"
        retry
        @retry="(capabilitiesQuery.refetch(), templatesQuery.refetch())"
      />
    </div>

    <form
      v-else
      data-mailbox-form
      class="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="submit"
    >
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <p
        v-if="formMessage"
        role="alert"
        data-form-error
        class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {{ resolveText(formMessage, t) }}
      </p>
      <ProblemMessage :problem="form.formProblem.value" :retry="retryable" @retry="submit" />

      <FormField
        :id="`${ID}-localPart`"
        :label="lt('add.mailbox_username')"
        required
        :errors="form.errorsFor('localPart')"
      >
        <template #default="control">
          <div class="flex min-w-0">
            <input
              v-bind="control"
              v-model="localPart"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              maxlength="64"
              class="form-control min-w-0 flex-1 rounded-e-none"
            />
            <span
              class="inline-flex max-w-[50%] items-center rounded-e-lg border border-s-0 border-gray-300 bg-gray-50 px-3 text-gray-700 wrap-anywhere dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >@{{ domainData?.unicodeName ?? domain ?? '…' }}</span
            >
          </div>
        </template>
      </FormField>
      <FormField
        :id="`${ID}-displayName`"
        :label="lt('add.full_name')"
        :errors="form.errorsFor('displayName')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="displayName"
            type="text"
            autocomplete="off"
            :maxlength="MAILBOX_DISPLAY_NAME_MAX"
            class="form-control"
          />
        </template>
      </FormField>
      <DomainPicker
        :id="`${ID}-domain`"
        :label="lt('add.domain')"
        :sources="[domainPickerSource()]"
        :model-value="domain"
        :labels="domainLabels"
        required
        :errors="form.errorsFor('domain')"
        @pick="remember"
        @update:model-value="domain = ($event as string | null) ?? null"
      />
      <TemplateSelect
        :id="`${ID}-template`"
        :label="lt('mailbox.template')"
        :model-value="templateId"
        :templates="templates"
        :errors="form.errorsFor('templateId')"
        @update:model-value="templateId = $event"
      />
      <PasswordFields
        v-model:password="password"
        v-model:password2="password2"
        :id-prefix="ID"
        mode="add"
        :policy="policy"
        :errors="form.errorsFor('password')"
        :repeat-errors="form.errorsFor('password2')"
      />
      <MailboxValueFields
        v-model="values"
        :id-prefix="ID"
        :capabilities="capabilities"
        :errors-for="form.errorsFor"
        :gates="gates"
      >
        <template #quota>
          <MailboxQuotaField
            :id="`${ID}-quota`"
            :model-value="values.quota"
            label-key="add.quota_mb"
            :max="maxQuota"
            :awaiting-domain="!domain"
            :exhausted="exhausted"
            :errors="form.errorsFor('quota')"
            @update:model-value="values = { ...values!, quota: $event }"
          />
        </template>
      </MailboxValueFields>
      <div
        data-sticky-save
        class="sticky bottom-0 z-10 -mx-4 flex gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 sm:-mx-5 sm:px-5 dark:border-gray-800 dark:bg-gray-900/95"
      >
        <button
          type="submit"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="secret.pending.value"
        >
          {{ secret.pending.value ? t('sections.saving') : lt('admin.add') }}
        </button>
        <RouterLink :to="{ name: 'mailboxes' }" :class="buttonVariants({ variant: 'outline' })">
          {{ lt('footer.cancel') }}
        </RouterLink>
      </div>
    </form>
  </section>
</template>

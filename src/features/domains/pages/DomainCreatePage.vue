<script setup lang="ts">
// Adding a domain (UI 002 US2, FR-018 to FR-028): the classic "Add domain" form
// `templates/modals/mailbox.twig` #addDomainModal on its own page, 1:1 (owner rule): its fields,
// labels, help texts, order and groups, the Default template applied when it opens, another
// template replacing the values without asking, and its actions: "Add domain only" and "Add domain
// and restart SOGo", or "Add" when the groupware is disabled, followed by legacy's note. Errors are
// shown next to their fields with a summary, with legacy's messages where legacy has one; leaving
// with entered values asks first. After the creation the domain page opens with the outcomes.
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { lt } from '@/i18n'
import type { DomainTemplate } from '@/api'
import LegacyText from '@/shared/components/LegacyText.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { buttonVariants } from '@/shared/ui/button'

import { problemOf } from '../api'
import { useDomainCapabilities } from '../capabilities'
import DomainNameField from '../components/fields/DomainNameField.vue'
import DomainValueFields from '../components/fields/DomainValueFields.vue'
import TemplateSelect from '../components/fields/TemplateSelect.vue'
import { useClientErrors } from '../composables/useClientErrors'
import { useCreateDomain } from '../composables/useCreateDomain'
import {
  applyTemplate,
  initialValues,
  toCreateRequest,
  validateCreate,
  type CreateFormValues,
} from '../create-form'
import { SIZE_FIELDS } from '../field-labels'
import { formFieldIds, formLabel } from '../form-labels'
import { useDomainFormat } from '../format'
import { allTemplatesOptions } from '../templates-api'

const ID_PREFIX = 'create'

const { t } = useI18n()
const router = useRouter()
const format = useDomainFormat()
const translateErrors = useClientErrors()
const creation = useCreateDomain()
const ids = formFieldIds(ID_PREFIX)

const capabilitiesQuery = useDomainCapabilities()
const capabilities = computed(() => capabilitiesQuery.data.value)
const templatesQuery = useQuery(
  computed(() => ({
    ...allTemplatesOptions(capabilities.value?.maxPageSize ?? 1000),
    enabled: !!capabilities.value,
  })),
)
const templates = computed<DomainTemplate[]>(() => templatesQuery.data.value?.data ?? [])
const loading = computed(() => capabilitiesQuery.isPending.value || templatesQuery.isPending.value)
const loadProblem = computed(
  () => problemOf(capabilitiesQuery.error.value) ?? problemOf(templatesQuery.error.value),
)

const values = ref<CreateFormValues | null>(null)
let baseline = ''
watch(
  [capabilities, () => templatesQuery.data.value],
  ([caps, page]) => {
    if (values.value || !caps || !page) return
    values.value = initialValues(page.data, caps)
    baseline = JSON.stringify(values.value)
  },
  { immediate: true },
)
const entered = computed(() => !!values.value && JSON.stringify(values.value) !== baseline)
const guard = useLeaveGuard(entered, { messageKey: 'leaveGuard.body' })

const form = useProblemForm({
  fieldId: (path) => ids[path] ?? ids[path.split('.')[0] ?? ''] ?? null,
  fieldKind: (path) => (SIZE_FIELDS.has(path) ? 'size' : undefined),
  labelFor: (field) => formLabel('domainAdd', field),
})

function onTemplate(id: number) {
  if (!values.value || !capabilities.value) return
  const chosen = templates.value.find((item) => item.id === id) ?? null
  values.value = applyTemplate(values.value, chosen, capabilities.value)
}

function update<K extends keyof CreateFormValues>(key: K, value: CreateFormValues[K]) {
  if (values.value) values.value = { ...values.value, [key]: value }
}

/** Legacy's messages for the refusals it can report (docs/conventions.md "Messages"). */
async function showProblem(problem: NonNullable<ReturnType<typeof problemOf>>, name: string) {
  if (problem.is('domain-exists')) {
    await form.setClientMessages({ name: [lt('danger.domain_exists', name)] })
    return
  }
  const nameCodes = problem.fieldErrors.get('name')?.map((violation) => String(violation.code))
  if (nameCodes?.includes('reserved')) {
    await form.setClientMessages({ name: [lt('danger.domain_cannot_match_hostname')] })
    return
  }
  if (nameCodes?.some((code) => code === 'invalidFormat' || code === 'required')) {
    await form.setClientMessages({ name: [lt('danger.domain_invalid')] })
    return
  }
  await form.setProblem(problem)
}

/** The action chosen last, so that a retry repeats it. */
let restartChosen = false

async function submit(restart: boolean) {
  restartChosen = restart
  if (!values.value || !capabilities.value || creation.pending.value) return
  const errors = validateCreate(values.value, capabilities.value, format)
  if (Object.keys(errors).length > 0) {
    await form.setClientMessages(translateErrors(errors))
    return
  }
  form.clear()
  const request = toCreateRequest(values.value, capabilities.value, restart)
  const result = await creation.create(request)
  if (result.ok) {
    guard.disarm()
    await router.replace({ name: 'domain-detail', params: { domain: result.domain.name } })
    return
  }
  await showProblem(result.problem, request.name)
}

const retryable = computed(() => {
  const problem = form.formProblem.value
  return (
    !!problem &&
    (problem.kind !== 'problem' || problem.is('temporary-failure') || (problem.status ?? 0) >= 500)
  )
})
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="lt('mailbox.add_domain')" />

    <div v-if="loading && !loadProblem" data-page-loading role="status" aria-busy="true">
      <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
    </div>
    <div v-else-if="loadProblem" class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('domains.create.loadFailed') }}
      </p>
      <ProblemMessage
        :problem="loadProblem"
        retry
        @retry="
          () => {
            void capabilitiesQuery.refetch()
            void templatesQuery.refetch()
          }
        "
      />
    </div>

    <form
      v-else-if="values && capabilities"
      data-domain-form
      class="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="submit(false)"
    >
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <ProblemMessage
        :problem="form.formProblem.value"
        :retry="retryable"
        @retry="submit(restartChosen)"
      />
      <DomainValueFields
        v-model="values"
        :id-prefix="ID_PREFIX"
        form="domainAdd"
        :capabilities="capabilities"
        :errors-for="form.errorsFor"
      >
        <template #lead>
          <DomainNameField
            :id="ids.name!"
            :label="formLabel('domainAdd', 'name')"
            :model-value="values.name"
            :errors="form.errorsFor('name')"
            @update:model-value="update('name', $event)"
          />
          <FormField
            :id="ids.description!"
            :label="formLabel('domainAdd', 'description')"
            :errors="form.errorsFor('description')"
          >
            <template #default="control">
              <input
                v-bind="control"
                :value="values.description"
                type="text"
                autocomplete="off"
                class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                @input="update('description', ($event.target as HTMLInputElement).value)"
              />
            </template>
          </FormField>
          <TemplateSelect
            :id="ids.templateId!"
            :label="formLabel('domainAdd', 'templateId')"
            :model-value="values.templateId"
            :templates="templates"
            :errors="form.errorsFor('templateId')"
            @update:model-value="onTemplate"
          />
        </template>
      </DomainValueFields>
      <div
        data-sticky-save
        class="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 sm:-mx-5 sm:px-5 dark:border-gray-800 dark:bg-gray-900/95"
      >
        <template v-if="capabilities.groupwareEnabled">
          <button
            type="submit"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="creation.pending.value"
          >
            {{ lt('add.add_domain_only') }}
          </button>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="creation.pending.value"
            @click="submit(true)"
          >
            {{ lt('add.add_domain_restart') }}
          </button>
        </template>
        <button
          v-else
          type="submit"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="creation.pending.value"
        >
          {{ lt('add.add') }}
        </button>
      </div>
      <LegacyText
        v-if="capabilities.groupwareEnabled"
        k="add.post_domain_add"
        as="p"
        data-post-domain-add
        class="text-sm text-gray-700 dark:text-gray-300"
      />
    </form>
  </section>
</template>

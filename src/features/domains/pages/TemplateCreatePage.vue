<script setup lang="ts">
// Adding a domain template (UI 002 US6, FR-051, FR-052): one form as the classic "Add Template"
// form `templates/modals/mailbox.twig` #addDomainTemplateModal has (owner rule 1:1), with its
// fields, labels, help texts, order, groups and "Add" action, on its own page. The fields start
// with the template defaults (FR-052); errors are shown next to their fields with a summary; a
// duplicate name shows the classic "Template … already exists" on the name; leaving with entered
// values asks first. After the creation the template list opens and the creation is announced.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { buttonVariants } from '@/shared/ui/button'

import { problemOf } from '../api'
import { useDomainCapabilities } from '../capabilities'
import DomainValueFields from '../components/fields/DomainValueFields.vue'
import { useClientErrors } from '../composables/useClientErrors'
import { SIZE_FIELDS } from '../field-labels'
import { useDomainFormat } from '../format'
import {
  newTemplateValues,
  toTemplateCreateRequest,
  validateTemplate,
  type TemplateFormValues,
} from '../template-form'
import { formFieldIds, formLabel } from '../form-labels'
import { createTemplate } from '../templates-api'

const ID_PREFIX = 'template-add'

const { t } = useI18n()
const router = useRouter()
const queryClient = useQueryClient()
const format = useDomainFormat()
const translateErrors = useClientErrors()
const ids = formFieldIds(ID_PREFIX)

const capabilitiesQuery = useDomainCapabilities()
const capabilities = computed(() => capabilitiesQuery.data.value)

const values = ref<TemplateFormValues | null>(null)
let baseline = ''
watch(
  capabilities,
  (caps) => {
    if (values.value || !caps) return
    values.value = newTemplateValues(caps)
    baseline = JSON.stringify(values.value)
  },
  { immediate: true },
)
const entered = computed(() => !!values.value && JSON.stringify(values.value) !== baseline)
const guard = useLeaveGuard(entered, { messageKey: 'leaveGuard.body' })

const form = useProblemForm({
  fieldId: (path) => ids[path] ?? ids[path.split('.')[0] ?? ''] ?? null,
  fieldKind: (path) => (SIZE_FIELDS.has(path) ? 'size' : undefined),
  labelFor: (field) => formLabel('templateAdd', field),
})

const pending = ref(false)
async function submit() {
  if (!values.value || !capabilities.value || pending.value) return
  const errors = validateTemplate(values.value, capabilities.value, format)
  if (Object.keys(errors).length > 0) {
    await form.setClientMessages(translateErrors(errors))
    return
  }
  form.clear()
  pending.value = true
  try {
    const created = await createTemplate(queryClient, toTemplateCreateRequest(values.value))
    guard.disarm()
    announce(lt('success.template_added', created.name))
    await router.replace({ name: 'domain-templates' })
  } catch (error) {
    const problem = problemOf(error)!
    if (problem.is('domain-template-name-exists')) {
      await form.setClientMessages({
        name: [lt('danger.template_exists', values.value.name.trim())],
      })
    } else {
      await form.setProblem(problem)
    }
  } finally {
    pending.value = false
  }
}

const retryable = computed(() => {
  const problem = form.formProblem.value
  return !!problem && (problem.kind !== 'problem' || (problem.status ?? 0) >= 500)
})
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="lt('mailbox.add_template')" />

    <div v-if="capabilitiesQuery.isPending.value" data-page-loading role="status" aria-busy="true">
      <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
    </div>
    <div v-else-if="!capabilities" class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('domainTemplates.create.loadFailed') }}
      </p>
      <ProblemMessage
        :problem="problemOf(capabilitiesQuery.error.value)"
        retry
        @retry="capabilitiesQuery.refetch()"
      />
    </div>

    <form
      v-else-if="values"
      data-template-form
      class="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="submit"
    >
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <ProblemMessage :problem="form.formProblem.value" :retry="retryable" @retry="submit" />
      <DomainValueFields
        v-model="values"
        :id-prefix="ID_PREFIX"
        form="templateAdd"
        :capabilities="capabilities"
        :errors-for="form.errorsFor"
      />
      <div
        data-sticky-save
        class="sticky bottom-0 z-10 -mx-4 flex gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 sm:-mx-5 sm:px-5 dark:border-gray-800 dark:bg-gray-900/95"
      >
        <button type="submit" :class="buttonVariants({ variant: 'default' })" :disabled="pending">
          {{ pending ? t('sections.saving') : lt('admin.add') }}
        </button>
        <RouterLink
          :to="{ name: 'domain-templates' }"
          :class="buttonVariants({ variant: 'outline' })"
        >
          {{ lt('footer.cancel') }}
        </RouterLink>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
// Adding a mailbox template (US7, FR-059, FR-060): one form as the classic "Add Template" form
// #addMailboxTemplateModal has (owner rule 1:1), with its fields, labels, help texts, order and
// "Add" action, on its own page for administrators. The fields start with the built-in defaults
// (`MailboxCapabilities.templateDefaults`, G32) and every value is sent, so the template holds what
// the form showed (US7-AS2); errors are shown next to their fields with a summary; a duplicate name
// shows legacy's "Template … already exists" on the name; leaving with entered values asks first.
// After the creation the template list opens and legacy's `success.template_added` is announced.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { buttonVariants } from '@/shared/ui/button'
import type { ClientErrors } from '@/shared/validation/client-errors'
import { MAILBOX_TEMPLATE_NAME_MAX } from '@/shared/validation/limits'

import MailboxValueFields from '../../components/fields/MailboxValueFields.vue'
import { useMailboxCapabilities } from '../../composables/useMailboxCapabilities'
import { templateBody, valuesFrom, type MailboxValues } from '../../form-values'
import { mailboxProblem } from '../../problems'
import { useTemplateDisplay } from '../../templates/display'
import { checkTemplate, templateFieldId } from '../../templates/template-form'
import { createTemplate } from '../../templates-api'

const ID_PREFIX = 'template-add'

const { t } = useI18n()
const router = useRouter()
const queryClient = useQueryClient()
const translate = useClientErrors()
const display = useTemplateDisplay()

const capabilitiesQuery = useMailboxCapabilities()
const capabilities = computed(() => capabilitiesQuery.data.value)

const name = ref('')
const values = ref<MailboxValues | null>(null)
let baseline = ''
watch(
  capabilities,
  (caps) => {
    if (values.value || !caps) return
    values.value = valuesFrom(caps.templateDefaults)
    baseline = JSON.stringify(values.value)
  },
  { immediate: true },
)
const entered = computed(
  () => name.value !== '' || (!!values.value && JSON.stringify(values.value) !== baseline),
)
const guard = useLeaveGuard(entered, { messageKey: 'leaveGuard.body' })

const form = useProblemForm({
  fieldId: (path) => templateFieldId(ID_PREFIX, path),
  fieldKind: (path) => (path === 'quota' ? 'size' : undefined),
  labelFor: (field) => display.label(field),
})

const pending = ref(false)
async function submit() {
  if (!values.value || pending.value) return
  const errors: ClientErrors = {}
  const checked = checkTemplate(errors, name.value, values.value)
  if (!checked) {
    await form.setClientMessages(translate(errors))
    return
  }
  form.clear()
  pending.value = true
  try {
    const created = await createTemplate(queryClient, {
      name: name.value.trim(),
      ...templateBody(values.value, checked),
    })
    guard.disarm()
    announce(lt('success.template_added', created.name))
    await router.replace({ name: 'mailbox-templates' })
  } catch (error) {
    const view = mailboxProblem(problemOf(error)!, { templateName: name.value.trim() })
    if (Object.keys(view.fields).length > 0) await form.setClientMessages(translate(view.fields))
    if (view.rest) await form.setProblem(view.rest)
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
      <FormField
        :id="`${ID_PREFIX}-name`"
        :label="lt('mailbox.template')"
        required
        :errors="form.errorsFor('name')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="name"
            type="text"
            autocomplete="off"
            :maxlength="MAILBOX_TEMPLATE_NAME_MAX"
            class="form-control"
          />
        </template>
      </FormField>
      <MailboxValueFields
        v-model="values"
        :id-prefix="ID_PREFIX"
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
          :to="{ name: 'mailbox-templates' }"
          :class="buttonVariants({ variant: 'outline' })"
        >
          {{ lt('footer.cancel') }}
        </RouterLink>
      </div>
    </form>
  </section>
</template>

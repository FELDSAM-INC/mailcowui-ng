<script setup lang="ts">
// The template page (UI 002 US6, FR-051, FR-053, FR-054): legacy's edit heading with the template's
// name, no badge (docs/conventions.md "Detail pages"), and one form as the classic edit page
// `templates/edit/domain-templates.twig` has (owner rule 1:1), with its fields, labels, help texts,
// order and groups, and "Save changes". The Default template's name is read-only. An outdated save
// lists what changed in the meantime; leaving with unsaved changes asks first. An unknown template
// shows the not-found page with a way back to the list (FR-004).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { lt } from '@/i18n'
import { isApiProblem } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { problemOf } from '../api'
import { useDomainCapabilities } from '../capabilities'
import SectionProblem from '../components/detail/SectionProblem.vue'
import DomainValueFields from '../components/fields/DomainValueFields.vue'
import { useTemplateEditForm } from '../composables/useTemplateEditForm'
import { useTemplate } from '../templates-api'
import { useStickyBarFocus } from '@/shared/composables/useStickyBarFocus'

const { t } = useI18n()
const route = useRoute()
const capabilitiesQuery = useDomainCapabilities()
const capabilities = computed(() => capabilitiesQuery.data.value)

const id = computed(() => Number(route.params.templateId))
const query = useTemplate(id)
const template = computed(() => query.data.value)
const notFound = computed(
  () => !template.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)

const edit = useTemplateEditForm({
  template: () => template.value,
  capabilities: () => capabilities.value,
  idPrefix: 'template-edit',
})
useLeaveGuard(edit.dirty, { messageKey: 'leaveGuard.body' })

useStickyBarFocus()
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'domain-templates' }"
    :back-label="t('domainTemplates.detail.backToList')"
  />
  <div
    v-else-if="!template && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-3xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ t('domainTemplates.detail.loading') }}</p>
  </div>
  <section v-else-if="!template" class="mx-auto flex w-full max-w-3xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ lt('edit.title') }}
    </h1>
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('domainTemplates.detail.loadFailed') }}
    </p>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <RouterLink
      :to="{ name: 'domain-templates' }"
      class="inline-flex min-h-11 items-center self-start text-sm font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
    >
      <span aria-hidden="true">←&nbsp;</span>{{ lt('edit.previous') }}
    </RouterLink>
    <PageHeader :title="lt('edit.title')" :description="template.name">
      <template #actions>
        <HistoryLink target-type="domainTemplate" :target-id="String(template.id)" />
      </template>
    </PageHeader>

    <form
      v-if="edit.values.value && capabilities"
      data-template-form
      class="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="edit.save()"
    >
      <ErrorSummary :id="edit.form.summaryId" :items="edit.form.summary.value" />
      <SectionProblem
        :problem="edit.problem.value"
        list-route="domain-templates"
        gone-key="domainTemplates.edit.gone"
        back-key="domainTemplates.detail.backToList"
        @retry="edit.save()"
      />
      <div
        v-if="edit.outdated.value"
        data-outdated
        role="alert"
        class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <WarningIcon class="mt-0.5 size-5 shrink-0" />
        <div class="flex min-w-0 flex-col gap-2">
          <p class="font-medium">{{ t('sections.outdated.title') }}</p>
          <p>{{ t('sections.outdated.body') }}</p>
          <ul class="list-disc ps-5">
            <li v-for="change in edit.outdated.value" :key="change.field" class="break-words">
              {{ t('sections.outdated.savedAs', { field: change.label, value: change.saved }) }}
            </li>
          </ul>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :class="buttonVariants({ variant: 'default', size: 'sm' })"
              :disabled="edit.pending.value"
              @click="edit.saveAgain()"
            >
              {{ t('sections.saveAgain') }}
            </button>
            <button
              type="button"
              :class="buttonVariants({ variant: 'outline', size: 'sm' })"
              @click="edit.discard()"
            >
              {{ t('sections.discard') }}
            </button>
          </div>
        </div>
      </div>
      <DomainValueFields
        v-model="edit.values.value"
        id-prefix="template-edit"
        form="templateEdit"
        :capabilities="capabilities"
        :errors-for="edit.errorsFor"
        :name-readonly="template.isDefault"
      />
      <div
        data-sticky-save
        class="sticky bottom-0 z-10 -mx-4 flex gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 sm:-mx-5 sm:px-5 dark:border-gray-800 dark:bg-gray-900/95"
      >
        <button
          type="submit"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="edit.pending.value"
        >
          {{ edit.pending.value ? t('sections.saving') : lt('admin.save') }}
        </button>
      </div>
    </form>
  </article>
</template>

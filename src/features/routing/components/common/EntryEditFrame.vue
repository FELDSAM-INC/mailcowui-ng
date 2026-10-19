<script setup lang="ts">
// The frame of a routing entry's edit page (research R6, legacy form map part 1b): legacy's
// `edit.previous` back link and `edit.title` heading with the entry as description, History for
// administrators, the form with its error summary, a problem message, the outdated notice with
// "Save again" and "Discard my changes", and the sticky action bar with legacy's `edit.save`. An
// unknown entry shows "not found" with the way back to the list; a failed read offers a retry.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { isApiProblem, problemOf, type ApiProblem } from '@/api'
import { lt } from '@/i18n'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import type { SummaryItem } from '@/shared/composables/useProblemForm'
import { useStickyBarFocus } from '@/shared/composables/useStickyBarFocus'
import { WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import FormActionBar from './FormActionBar.vue'

const props = withDefaults(
  defineProps<{
    listRoute: string
    loaded: boolean
    pending: boolean
    error: unknown
    description?: string
    history?: { targetType: string; targetId: string } | null
    summaryId: string
    summary: readonly SummaryItem[]
    problem: ApiProblem | null
    outdated: readonly { field: string; label: string; saved: string }[] | null
    saving: boolean
    /** Without a save action the entry is shown read-only (a domain administrator without a flag). */
    readOnly?: boolean
  }>(),
  { description: undefined, history: null, readOnly: false },
)
const emit = defineEmits<{ submit: []; saveAgain: []; discard: []; retry: [] }>()
const { t } = useI18n()

const notFound = computed(
  () => !props.loaded && isApiProblem(props.error) && props.error.status === 404,
)
const gone = computed(() => props.problem?.status === 404)

useStickyBarFocus()
</script>

<template>
  <NotFoundPage
    v-if="notFound || gone"
    :back-to="{ name: listRoute }"
    :back-label="t('routing.common.backToList')"
  />
  <div
    v-else-if="!loaded && pending"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-3xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
  </div>
  <section v-else-if="!loaded" class="mx-auto flex w-full max-w-3xl flex-col gap-3">
    <PageHeader :title="lt('edit.title')" />
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('routing.common.loadFailed') }}
    </p>
    <ProblemMessage :problem="problemOf(error)" retry @retry="emit('retry')" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <RouterLink
      :to="{ name: listRoute }"
      class="inline-flex min-h-11 items-center self-start text-sm font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
    >
      <span aria-hidden="true">←&nbsp;</span>{{ lt('edit.previous') }}
    </RouterLink>
    <PageHeader :title="lt('edit.title')" :description="description">
      <template v-if="history" #actions>
        <HistoryLink :target-type="history.targetType" :target-id="history.targetId" />
      </template>
    </PageHeader>
    <slot name="before" />
    <form
      data-entry-form
      class="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="outdated ? emit('saveAgain') : emit('submit')"
    >
      <ErrorSummary :id="summaryId" :items="summary" />
      <ProblemMessage :problem="problem" />
      <div
        v-if="outdated"
        data-outdated
        role="alert"
        class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <WarningIcon class="mt-0.5 size-5 shrink-0" />
        <div class="flex min-w-0 flex-col gap-2">
          <p class="font-medium">{{ t('sections.outdated.title') }}</p>
          <p>{{ t('sections.outdated.body') }}</p>
          <ul class="list-disc ps-5">
            <li v-for="change in outdated" :key="change.field" class="wrap-anywhere">
              {{ t('sections.outdated.savedAs', { field: change.label, value: change.saved }) }}
            </li>
          </ul>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :class="buttonVariants({ variant: 'default', size: 'sm' })"
              :disabled="saving"
              @click="emit('saveAgain')"
            >
              {{ t('sections.saveAgain') }}
            </button>
            <button
              type="button"
              :class="buttonVariants({ variant: 'outline', size: 'sm' })"
              @click="emit('discard')"
            >
              {{ t('sections.discard') }}
            </button>
          </div>
        </div>
      </div>
      <slot />
      <FormActionBar
        v-if="!readOnly"
        :submit-label="lt('edit.save')"
        :pending="saving"
        :cancel-to="{ name: listRoute }"
      />
    </form>
  </article>
</template>

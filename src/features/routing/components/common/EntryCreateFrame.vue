<script setup lang="ts">
// The frame of a routing add page (legacy form map part 1b): the classic add form on its own page,
// headed by the add action's label, with the form's legacy hint, the error summary, a problem
// message, the fields and the sticky action bar with legacy's `admin.add`.
import type { ApiProblem } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import type { SummaryItem } from '@/shared/composables/useProblemForm'
import { useStickyBarFocus } from '@/shared/composables/useStickyBarFocus'

import FormActionBar from './FormActionBar.vue'

withDefaults(
  defineProps<{
    title: string
    hint?: LegacyKey | null
    listRoute: string
    summaryId: string
    summary: readonly SummaryItem[]
    problem: ApiProblem | null
    saving: boolean
    retry?: boolean
  }>(),
  { hint: null, retry: false },
)
const emit = defineEmits<{ submit: [] }>()

useStickyBarFocus()
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="title" />
    <LegacyText
      v-if="hint"
      :k="hint"
      as="p"
      data-form-hint
      class="-mt-4 text-sm text-gray-700 dark:text-gray-300"
    />
    <slot name="before" />
    <form
      data-entry-form
      class="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="emit('submit')"
    >
      <ErrorSummary :id="summaryId" :items="summary" />
      <ProblemMessage :problem="problem" :retry="retry" @retry="emit('submit')" />
      <slot />
      <FormActionBar
        :submit-label="lt('admin.add')"
        :pending="saving"
        :cancel-to="{ name: listRoute }"
      />
    </form>
  </section>
</template>

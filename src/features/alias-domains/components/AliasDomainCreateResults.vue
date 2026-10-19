<script setup lang="ts">
// The result of each name of a multi-name creation (FR-037, research R9): a created name with a
// link to its page and legacy's alerts for its outcomes, a refused name with legacy's message, or
// "not processed" when the run stopped before it. Announced, and focused when it appears.
import { nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CreationReport from '@/shared/components/CreationReport.vue'
import type { EntryResult } from '@/shared/composables/useSequentialCreate'
import { CheckIcon, CloseIcon, InfoIcon } from '@/shared/icons'

import type { CreatedAliasDomain } from '../api'
import { creationAlerts } from '../creation-report'

defineProps<{
  results: readonly EntryResult<CreatedAliasDomain>[]
  /** The message of a refused name. */
  message: (result: EntryResult<CreatedAliasDomain>) => string
}>()
const { t } = useI18n()
const root = ref<HTMLElement | null>(null)

onMounted(async () => {
  await nextTick()
  root.value?.focus()
})

const LINK =
  'font-medium break-all underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-brand-500'
</script>

<template>
  <section
    ref="root"
    data-create-results
    tabindex="-1"
    :aria-label="t('bulk.summary.title')"
    class="rounded-2xl border border-gray-200 bg-white p-4 focus:outline-2 focus:outline-brand-500 dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ t('bulk.summary.title') }}
    </h2>
    <ul class="mt-3 flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
      <li
        v-for="result in results"
        :key="result.entry.index"
        :data-outcome="result.outcome"
        class="flex min-w-0 flex-col gap-2 py-3 text-sm"
      >
        <span class="flex min-w-0 gap-2 text-gray-900 dark:text-white">
          <CheckIcon
            v-if="result.outcome === 'created'"
            class="mt-0.5 size-4 shrink-0 text-green-700 dark:text-green-400"
          />
          <CloseIcon
            v-else-if="result.outcome === 'refused'"
            class="mt-0.5 size-4 shrink-0 text-red-700 dark:text-red-400"
          />
          <InfoIcon v-else class="mt-0.5 size-4 shrink-0 text-gray-600 dark:text-gray-400" />
          <span class="min-w-0">
            <RouterLink
              v-if="result.outcome === 'created' && result.data"
              :to="{
                name: 'alias-domain-detail',
                params: { aliasDomain: result.data.aliasDomain.name },
              }"
              :class="LINK"
              >{{ result.data.aliasDomain.nameUnicode }}</RouterLink
            >
            <template v-else>
              <span class="font-medium break-all">{{ result.entry.value }}</span
              >{{ result.outcome === 'notProcessed' ? `: ${t('bulk.outcome.notProcessed')}` : '' }}
              <span v-if="result.outcome === 'refused'" class="block">{{ message(result) }}</span>
            </template>
          </span>
        </span>
        <CreationReport
          v-if="result.outcome === 'created' && result.data"
          :alerts="creationAlerts(result.data.aliasDomain.name, result.data.report)"
          :dismissible="false"
        />
      </li>
    </ul>
  </section>
</template>

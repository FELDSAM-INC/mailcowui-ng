<script setup lang="ts">
// The result of each address of a multi-address creation (FR-021, research R9): legacy's
// `success.alias_added` with a link to the new alias, the refused address with legacy's message,
// or "not processed" when the run stopped before it. Announced, and focused when it appears.
import { nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Alias } from '@/api'
import { lt } from '@/i18n'
import type { EntryResult } from '@/shared/composables/useSequentialCreate'
import { announce } from '@/shared/composables/useAnnouncer'
import { CheckIcon, CloseIcon, InfoIcon } from '@/shared/icons'

const props = defineProps<{
  results: readonly EntryResult<Alias>[]
  /** The message of a refused address. */
  message: (result: EntryResult<Alias>) => string
}>()
const { t } = useI18n()
const root = ref<HTMLElement | null>(null)

const text = (result: EntryResult<Alias>) =>
  result.outcome === 'created' && result.data
    ? lt('success.alias_added', result.data.address, result.data.id)
    : result.outcome === 'refused'
      ? props.message(result)
      : t('bulk.outcome.notProcessed')

onMounted(async () => {
  await nextTick()
  root.value?.focus()
  announce(props.results.map((result) => `${result.entry.value}: ${text(result)}`).join(' '))
})
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
        class="flex min-w-0 gap-2 py-2 text-sm"
      >
        <CheckIcon
          v-if="result.outcome === 'created'"
          class="mt-0.5 size-4 shrink-0 text-green-700 dark:text-green-400"
        />
        <CloseIcon
          v-else-if="result.outcome === 'refused'"
          class="mt-0.5 size-4 shrink-0 text-red-700 dark:text-red-400"
        />
        <InfoIcon v-else class="mt-0.5 size-4 shrink-0 text-gray-600 dark:text-gray-400" />
        <span class="min-w-0 break-words text-gray-900 dark:text-white">
          <RouterLink
            v-if="result.outcome === 'created' && result.data"
            :to="{ name: 'alias-detail', params: { aliasId: result.data.id } }"
            class="underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >{{ text(result) }}</RouterLink
          >
          <template v-else>
            <span class="font-medium break-all">{{ result.entry.value }}</span
            >{{ result.outcome === 'notProcessed' ? `: ${text(result)}` : '' }}
            <span v-if="result.outcome === 'refused'" class="block">{{ text(result) }}</span>
          </template>
        </span>
      </li>
    </ul>
  </section>
</template>

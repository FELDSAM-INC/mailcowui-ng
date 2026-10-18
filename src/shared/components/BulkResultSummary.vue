<script setup lang="ts">
// The per-item result of a bulk action (conventions "Bulk actions", UI 001 R20, UI 002 research
// D22, FR-046): one row per item with its translated outcome as text and icon, the item's problem,
// the counts announced politely, and a retry of the failed, refused and outdated items.
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatList } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import { useProblemMessages } from '@/i18n/problems'

import { announce } from '../composables/useAnnouncer'
import { CheckIcon, CloseIcon, DangerIcon, InfoIcon, WarningIcon } from '../icons'
import { buttonVariants } from '../ui/button'
import {
  isRetryable,
  outcomeCounts,
  ROW_OUTCOMES,
  type BulkRow,
  type BulkRowOutcome,
} from './bulk-row'

const props = withDefaults(defineProps<{ rows: readonly BulkRow[]; title?: string }>(), {
  title: undefined,
})
const emit = defineEmits<{ retry: []; close: [] }>()
const { t, locale } = useI18n()
const { problemMessage } = useProblemMessages()

const ICONS: Record<BulkRowOutcome, typeof CheckIcon> = {
  done: CheckIcon,
  notFound: InfoIcon,
  refused: CloseIcon,
  outdated: WarningIcon,
  failed: DangerIcon,
  skipped: InfoIcon,
  unknown: WarningIcon,
  notProcessed: InfoIcon,
}

const TONE: Record<BulkRowOutcome, string> = {
  done: 'text-green-700 dark:text-green-400',
  notFound: 'text-gray-700 dark:text-gray-300',
  refused: 'text-red-700 dark:text-red-400',
  outdated: 'text-amber-700 dark:text-amber-400',
  failed: 'text-red-700 dark:text-red-400',
  skipped: 'text-gray-700 dark:text-gray-300',
  unknown: 'text-amber-700 dark:text-amber-400',
  notProcessed: 'text-gray-700 dark:text-gray-300',
}

const retryable = computed(() => props.rows.some(isRetryable))

const countText = computed(() => {
  const counts = outcomeCounts(props.rows)
  const parts = ROW_OUTCOMES.filter((outcome) => counts[outcome]).map((outcome) =>
    t(`bulk.count.${outcome}`, { count: counts[outcome]! }),
  )
  return formatList(parts, locale.value as AppLocale)
})

function announceCounts() {
  if (props.rows.length > 0) announce(t('bulk.summary.announce', { counts: countText.value }))
}

onMounted(announceCounts)
watch(() => props.rows, announceCounts)
</script>

<template>
  <section
    class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    :aria-label="title ?? t('bulk.summary.title')"
  >
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ title ?? t('bulk.summary.title') }}
    </h2>
    <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{{ countText }}</p>
    <ul class="mt-3 flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
      <li v-for="row in rows" :key="row.id" class="flex flex-col gap-1 py-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="min-w-0 flex-1 font-medium break-words text-gray-900 dark:text-white">
            {{ row.label }}
          </span>
          <span
            class="inline-flex items-center gap-1 text-sm font-medium"
            :class="TONE[row.outcome]"
          >
            <component :is="ICONS[row.outcome]" class="size-4" />
            {{ t(`bulk.outcome.${row.outcome}`) }}
          </span>
        </div>
        <p v-if="row.problem" class="text-sm break-words text-gray-700 dark:text-gray-300">
          {{ problemMessage(row.problem) }}
        </p>
      </li>
    </ul>
    <div class="mt-4 flex flex-wrap gap-2">
      <button
        v-if="retryable"
        type="button"
        :class="buttonVariants({ variant: 'default' })"
        @click="emit('retry')"
      >
        {{ t('bulk.retry') }}
      </button>
      <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="emit('close')">
        {{ t('common.close') }}
      </button>
    </div>
  </section>
</template>

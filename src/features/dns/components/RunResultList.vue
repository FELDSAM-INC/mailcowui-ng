<script setup lang="ts">
// The progress and results of a generation or copy run (research R8, data-model §7, FR-041): a
// progress bar while it runs, then one row per name with its outcome as text and icon, the classic
// interface's message for it (`success.dkim_added`, `success.dkim_duplicated`, the refusal's
// `danger.*`), the publication outcome and a link for created keys, and "Retry" for the refused,
// unknown and not processed names. Announced politely at the start, at each 10 % step and at the
// end with the counts, never moving the focus.
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import { formatList, formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { CheckIcon, CloseIcon, InfoIcon, WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { RETRYABLE, type RunOutcome, type RunRow } from '../dkim/generate-run'
import { dkimKeyLocation } from '../names'
import PublicationOutcome from './PublicationOutcome.vue'

const props = withDefaults(
  defineProps<{
    rows: readonly RunRow[]
    total: number
    /** The 1-based position of the name being sent; 0 when idle. */
    current: number
    running: boolean
    mode: 'generate' | 'copy'
    /** The copy source's name, for `success.dkim_duplicated`. */
    source?: string
    /** Whether the server publishes DKIM records (the outcomes are shown only then). */
    publication?: boolean
  }>(),
  { source: '', publication: false },
)
const emit = defineEmits<{ retry: [names: string[]] }>()
const { t, locale } = useI18n()
const { problemMessage } = useProblemMessages()

/** The shared bulk outcome labels (`bulk.outcome.*`); a created key is "done". */
const OUTCOME_KEYS: Record<RunOutcome, string> = {
  created: 'done',
  refused: 'refused',
  unknown: 'unknown',
  notProcessed: 'notProcessed',
  skipped: 'skipped',
}
const ICONS: Record<RunOutcome, typeof CheckIcon> = {
  created: CheckIcon,
  refused: CloseIcon,
  unknown: WarningIcon,
  notProcessed: InfoIcon,
  skipped: InfoIcon,
}
const TONES: Record<RunOutcome, string> = {
  created: 'text-green-700 dark:text-green-400',
  refused: 'text-red-700 dark:text-red-400',
  unknown: 'text-amber-700 dark:text-amber-400',
  notProcessed: 'text-gray-700 dark:text-gray-300',
  skipped: 'text-gray-700 dark:text-gray-300',
}

const number = (value: number) => formatNumber(value, locale.value as AppLocale)
const completed = computed(() => (props.running ? Math.max(0, props.current - 1) : props.total))

function message(row: RunRow): string | null {
  if (row.outcome === 'created') {
    return props.mode === 'copy'
      ? lt('success.dkim_duplicated', props.source, row.name)
      : lt('success.dkim_added', row.name)
  }
  if (row.outcome === 'refused' && row.problem) {
    return problemMessage(row.problem, { params: { name: row.name } })
  }
  if (row.outcome === 'unknown') return t('problem.outcome-unknown')
  return null
}

const countText = computed(() => {
  const counts = new Map<string, number>()
  for (const row of props.rows) {
    const key = OUTCOME_KEYS[row.outcome]
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const parts = [...counts].map(([key, count]) => t(`bulk.count.${key}`, { count: number(count) }))
  return formatList(parts, locale.value as AppLocale)
})

const retryNames = computed(() =>
  props.rows.filter((row) => RETRYABLE.includes(row.outcome)).map((row) => row.name),
)

let lastStep = -1
function announceStart() {
  lastStep = 0
  announce(t('dns.dkim.run.started', { count: number(props.total) }))
}

watch(
  () => props.running,
  (running, was) => {
    if (running && !was) announceStart()
    if (!running && was) announce(t('dns.dkim.run.finished', { counts: countText.value }))
  },
)
watch(completed, (value) => {
  if (!props.running || props.total === 0) return
  const step = Math.floor((value / props.total) * 10)
  if (step > lastStep && step > 0 && step < 10) {
    lastStep = step
    announce(t('dns.dkim.run.progress', { percent: number(step * 10) }))
  }
})
onMounted(() => {
  if (props.running) announceStart()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="running" data-run-progress class="flex flex-col gap-2">
      <p class="text-sm text-gray-800 dark:text-gray-200">
        {{ t('dns.dkim.run.status', { done: number(completed), total: number(total) }) }}
      </p>
      <div
        role="progressbar"
        :aria-label="t('dns.dkim.run.progressLabel')"
        aria-valuemin="0"
        :aria-valuemax="total"
        :aria-valuenow="completed"
        class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <progress
          class="block h-2 w-full appearance-none [&::-moz-progress-bar]:bg-brand-500 [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-brand-500"
          :max="Math.max(total, 1)"
          :value="completed"
          aria-hidden="true"
        />
      </div>
    </div>
    <template v-if="rows.length > 0">
      <p class="text-sm text-gray-700 dark:text-gray-300">{{ countText }}</p>
      <ul class="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
        <li v-for="row in rows" :key="row.name" data-run-row class="flex flex-col gap-1 py-2">
          <div class="flex flex-wrap items-center gap-2">
            <RouterLink
              v-if="row.outcome === 'created'"
              :to="dkimKeyLocation(row.name)"
              class="min-w-0 flex-1 font-medium break-all text-brand-700 underline underline-offset-2 dark:text-brand-300"
            >
              {{ row.label }}
            </RouterLink>
            <span
              v-else
              class="min-w-0 flex-1 font-medium break-all text-gray-900 dark:text-white"
              >{{ row.label }}</span
            >
            <span
              class="inline-flex items-center gap-1 text-sm font-medium"
              :class="TONES[row.outcome]"
            >
              <component :is="ICONS[row.outcome]" class="size-4" />
              {{ t(`bulk.outcome.${OUTCOME_KEYS[row.outcome]}`) }}
            </span>
          </div>
          <p v-if="message(row)" class="text-sm break-words text-gray-700 dark:text-gray-300">
            {{ message(row) }}
          </p>
          <PublicationOutcome
            v-if="row.result"
            :outcome="row.result.dnsPublication"
            :enabled="publication"
          >
            <template #action><slot name="publish-action" :row="row" /></template>
          </PublicationOutcome>
        </li>
      </ul>
      <div v-if="!running && retryNames.length > 0">
        <button
          type="button"
          data-run-retry
          :class="buttonVariants({ variant: 'default' })"
          @click="emit('retry', retryNames)"
        >
          {{ t('bulk.retry') }}
        </button>
      </div>
    </template>
  </div>
</template>

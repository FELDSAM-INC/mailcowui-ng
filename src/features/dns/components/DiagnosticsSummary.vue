<script setup lang="ts">
// The summary of a diagnostics result (FR-060, FR-062, SC-008): the number of checks per group,
// "all required records are correct" (with the number not verified), and the filter that keeps
// only the checks that need attention or were not verified.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DnsCheck } from '@/api'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

import { SUMMARY_GROUPS, summarize } from '../diagnostics/summary-groups'

const props = defineProps<{ checks: readonly DnsCheck[]; onlyAttention: boolean }>()
const emit = defineEmits<{ 'update:onlyAttention': [value: boolean] }>()
const { t, locale } = useI18n()

const counts = computed(() => summarize(props.checks))
const number = (value: number) => formatNumber(value, locale.value as AppLocale)
const TONES = {
  needsAttention: 'text-red-700 dark:text-red-400',
  notVerified: 'text-amber-800 dark:text-amber-300',
  optionalNotSet: 'text-gray-700 dark:text-gray-300',
  ok: 'text-green-700 dark:text-green-400',
} as const
</script>

<template>
  <section
    data-diagnostics-summary
    aria-labelledby="diagnostics-summary-title"
    class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="diagnostics-summary-title" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ t('dns.diagnostics.summary.title') }}
    </h2>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
      <li
        v-for="group in SUMMARY_GROUPS"
        :key="group"
        :data-summary-group="group"
        :class="TONES[group]"
      >
        {{ t(`dns.diagnostics.summary.groups.${group}`, { count: number(counts.groups[group]) }) }}
      </li>
    </ul>
    <p
      v-if="counts.requiredCorrect"
      data-required-correct
      class="text-sm text-gray-800 dark:text-gray-200"
    >
      {{
        counts.groups.notVerified > 0
          ? t('dns.diagnostics.summary.allCorrectUnverified', {
              count: number(counts.groups.notVerified),
            })
          : t('dns.diagnostics.summary.allCorrect')
      }}
    </p>
    <label class="inline-flex min-h-11 items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
      <input
        type="checkbox"
        class="size-5 rounded border-gray-300"
        :checked="onlyAttention"
        @change="emit('update:onlyAttention', ($event.target as HTMLInputElement).checked)"
      />
      {{ t('dns.diagnostics.summary.onlyAttention') }}
    </label>
  </section>
</template>

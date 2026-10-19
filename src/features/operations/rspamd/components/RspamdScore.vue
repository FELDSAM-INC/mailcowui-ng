<script setup lang="ts">
// A scan's score against the required score (FR-048): "{score} / {required}" as legacy shows it,
// with whether it is above or below the required score in text, and legacy's colour as an addition.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

const props = defineProps<{ score: number; required: number }>()
const { t, locale } = useI18n()
const below = computed(() => props.score < props.required)
const value = computed(() =>
  formatNumber(props.score, locale.value as AppLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
)
const required = computed(() => formatNumber(props.required, locale.value as AppLocale))
</script>

<template>
  <span class="inline-flex flex-wrap items-baseline gap-x-1">
    <span
      class="font-medium tabular-nums"
      :class="below ? 'text-success-700 dark:text-success-300' : 'text-red-700 dark:text-red-300'"
      >{{ `${value} / ${required}` }}</span
    >{{ ' '
    }}<span class="text-xs text-gray-600 dark:text-gray-400">{{
      below ? t('operations.rspamd.below') : t('operations.rspamd.above')
    }}</span>
  </span>
</template>

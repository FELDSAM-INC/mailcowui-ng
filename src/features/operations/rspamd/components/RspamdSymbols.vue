<script setup lang="ts">
// A scan's symbols in the API's order (legacy's order), each as "{name} ({score}) [{options}]" with
// legacy's colour for positive and negative scores; names and options are untrusted text.
import { useI18n } from 'vue-i18n'

import type { RspamdHistorySymbol } from '@/api'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import PlainText from '@/shared/components/PlainText.vue'

defineProps<{ symbols: readonly RspamdHistorySymbol[] }>()
const { locale } = useI18n()
const tone = (value: number) =>
  value < 0
    ? 'text-success-700 dark:text-success-300'
    : value > 0
      ? 'text-red-700 dark:text-red-300'
      : ''
const score = (value: number) =>
  formatNumber(value, locale.value as AppLocale, { maximumFractionDigits: 3 })
</script>

<template>
  <ul class="flex flex-col gap-1">
    <li v-for="(symbol, index) in symbols" :key="index" data-symbol class="wrap-anywhere">
      <strong><PlainText :value="symbol.name" /></strong>{{ ' '
      }}<span :class="tone(symbol.score)">({{ score(symbol.score) }})</span
      ><template v-if="symbol.options.length > 0"
        >{{ ' [' }}<PlainText :value="symbol.options.join(', ')" />{{ ']' }}</template
      >
    </li>
  </ul>
</template>

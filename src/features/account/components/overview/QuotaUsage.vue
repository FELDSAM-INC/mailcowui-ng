<script setup lang="ts">
import { computed } from 'vue'

import type { MailboxOverview } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'

const props = defineProps<{ quota: MailboxOverview['quota'] }>()
const format = useFormat()
const label = computed(
  () =>
    `${format.bytes(props.quota.usedBytes)} / ${props.quota.quotaBytes === 0 ? '∞' : format.bytes(props.quota.quotaBytes)}`,
)
const percent = computed(() => Math.min(100, Math.max(0, props.quota.percentUsed ?? 0)))
const colour = computed(() =>
  percent.value >= 90
    ? 'fill-red-700 dark:fill-red-400'
    : percent.value >= 75
      ? 'fill-amber-700 dark:fill-amber-400'
      : 'fill-brand-600 dark:fill-brand-400',
)
</script>

<template>
  <div class="flex flex-col gap-2" data-quota-usage>
    <p class="font-medium text-gray-900 dark:text-white">{{ label }}</p>
    <div
      v-if="quota.quotaBytes > 0"
      role="progressbar"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
      :aria-valuetext="`${label} (${format.number(quota.percentUsed ?? 0)}%)`"
      class="relative flex h-6 items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-800"
    >
      <!-- SVG width is a presentation attribute, compatible with the strict style CSP. -->
      <svg
        class="absolute inset-0 h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="none"
        viewBox="0 0 100 24"
      >
        <rect :width="percent" height="24" :class="colour" />
      </svg>
      <span
        class="relative rounded bg-white px-1 text-sm font-medium text-gray-900 dark:bg-gray-950 dark:text-white"
        >{{ format.number(quota.percentUsed ?? 0) }}%</span
      >
    </div>
    <p class="text-sm text-gray-600 dark:text-gray-400">
      {{ format.number(quota.messages) }} {{ lt('user.messages') }}
    </p>
  </div>
</template>

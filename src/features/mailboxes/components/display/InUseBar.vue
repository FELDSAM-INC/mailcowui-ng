<script setup lang="ts">
// Legacy's "In use (%)" column (`draw_mailbox_table`): a bar with the percentage as its text, in
// legacy's classes (success below 75 %, warning from 75 %, danger from 90 %). The percentage is the
// text, so the state never depends on colour alone. An unlimited quota has no percentage ("-").
import { computed } from 'vue'

import { useFormat } from '@/i18n/format'

const props = defineProps<{ percent: number | null }>()
const fmt = useFormat()
const width = computed(() => Math.min(100, Math.max(0, props.percent ?? 0)))
const tone = computed(() =>
  props.percent === null
    ? ''
    : props.percent >= 90
      ? 'bg-red-600'
      : props.percent >= 75
        ? 'bg-amber-500'
        : 'bg-green-600',
)
const label = computed(() =>
  props.percent === null ? '-' : fmt.number(props.percent / 100, { style: 'percent' }),
)
const levelClass = computed(() =>
  props.percent === null
    ? 'none'
    : props.percent >= 90
      ? 'danger'
      : props.percent >= 75
        ? 'warning'
        : 'success',
)
</script>

<template>
  <div :data-in-use="levelClass" class="flex min-w-20 items-center gap-2">
    <div
      v-if="percent !== null"
      aria-hidden="true"
      class="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
    >
      <div class="h-full rounded-full" :class="tone" :style="{ width: `${width}%` }" />
    </div>
    <span class="text-sm font-medium text-gray-900 tabular-nums dark:text-white">{{ label }}</span>
  </div>
</template>

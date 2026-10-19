<script setup lang="ts">
// A legacy badge (priority, service, method, type): the value as text, with the badge's colour as
// an addition only (FR-034). Long values wrap.
import type { BadgeTone } from '../log-types'

defineProps<{ tone: BadgeTone }>()

const TONES: Record<BadgeTone, string> = {
  success: 'bg-success-50 text-success-800 dark:bg-success-500/15 dark:text-success-300',
  warning: 'bg-warning-50 text-warning-800 dark:bg-warning-500/15 dark:text-warning-200',
  danger: 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200',
  info: 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200',
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}
</script>

<template>
  <span
    data-badge
    class="inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium wrap-anywhere"
    :class="TONES[tone]"
  >
    <slot />
  </span>
</template>

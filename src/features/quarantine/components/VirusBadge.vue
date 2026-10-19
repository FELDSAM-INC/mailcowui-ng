<script setup lang="ts">
// The virus state as a text badge (UI 006 FR-010, FR-079): legacy's `quarantine.high_danger` when
// the filter found a virus, otherwise `quarantine.neutral_danger`.
import { lt } from '@/i18n'

defineProps<{ virus: boolean }>()
</script>

<template>
  <span
    :data-virus="virus ? 'true' : 'false'"
    class="inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-sm font-medium"
    :class="
      virus
        ? 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200'
        : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200'
    "
  >
    {{ lt(virus ? 'quarantine.high_danger' : 'quarantine.neutral_danger') }}
  </span>
</template>

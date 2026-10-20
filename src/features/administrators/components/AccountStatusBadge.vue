<script setup lang="ts">
import { lt } from '@/i18n'
defineProps<{ active: boolean }>()
</script>
<template>
  <span
    class="inline-flex rounded-full border px-2 py-1 text-xs"
    :class="
      active
        ? 'border-green-300 text-green-800 dark:border-green-800 dark:text-green-200'
        : 'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300'
    "
    >{{ lt(active ? 'mailbox.active' : 'mailbox.inactive') }}</span
  >
</template>

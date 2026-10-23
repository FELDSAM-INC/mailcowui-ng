<script setup lang="ts">
// The active state as text (FR-006, FR-076): inactive records are marked by text, not colour alone.
import { lt } from '@/i18n'

defineProps<{ active: boolean }>()
</script>

<template>
  <span
    data-active-badge
    class="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium"
    :class="
      active
        ? 'bg-green-50 text-green-800 dark:bg-green-500/15 dark:text-green-300'
        : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200'
    "
  >
    {{ active ? lt('mailbox.active') : lt('mailbox.inactive') }}
  </span>
</template>

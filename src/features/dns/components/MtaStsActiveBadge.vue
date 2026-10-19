<script setup lang="ts">
// The active state of an MTA-STS policy as a text badge with an icon (FR-046, FR-055), with the
// classic list's "Active" and "Inactive".
import { lt } from '@/i18n'
import { CheckIcon, CloseIcon } from '@/shared/icons'

defineProps<{ active: boolean }>()
</script>

<template>
  <span
    data-mta-sts-active
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium"
    :class="
      active
        ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    "
  >
    <CheckIcon v-if="active" class="size-4" />
    <CloseIcon v-else class="size-4" />
    {{ active ? lt('mailbox.active') : lt('mailbox.inactive') }}
  </span>
</template>

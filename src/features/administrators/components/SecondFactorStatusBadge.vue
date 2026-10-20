<script setup lang="ts">
import type { AccountSecondFactorStatus } from '@/api'
import MessageText from '@/shared/components/MessageText.vue'
defineProps<{ status: AccountSecondFactorStatus }>()
</script>
<template>
  <span
    class="inline-flex rounded-full border px-2 py-1 text-xs"
    :class="
      status === 'active'
        ? 'border-green-300 text-green-800 dark:border-green-800 dark:text-green-200'
        : status === 'suspended'
          ? 'border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-200'
          : 'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300'
    "
    ><MessageText :k="`accounts.secondFactorStatus.${status}`"
  /></span>
</template>

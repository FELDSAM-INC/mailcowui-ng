<script setup lang="ts">
// An address: the readable form, and the ASCII form below it when they differ (edge case
// "internationalised names"). The local part is shown exactly as stored; long values wrap.
defineProps<{ address: string; addressUnicode: string }>()
</script>

<template>
  <span class="flex min-w-0 flex-col">
    <span class="break-all">{{ addressUnicode }}</span>
    <span
      v-if="addressUnicode !== address"
      class="text-sm font-normal break-all text-gray-600 dark:text-gray-400"
      >{{ address }}</span
    >
  </span>
</template>

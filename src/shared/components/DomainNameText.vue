<script setup lang="ts">
// A domain name (FR-006, edge case "internationalised and long names"): the readable name first,
// the ASCII name below it when they differ; long names wrap instead of scrolling.
defineProps<{ name: string; unicodeName: string }>()
</script>

<template>
  <span class="flex min-w-0 flex-col">
    <span class="break-all">{{ unicodeName }}</span>
    <span
      v-if="unicodeName !== name"
      class="text-sm font-normal break-all text-gray-600 dark:text-gray-400"
    >
      {{ name }}
    </span>
  </span>
</template>

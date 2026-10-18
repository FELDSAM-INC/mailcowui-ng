<script setup lang="ts">
// Read-only values of a section as a description list (FR-029: shown as text, never as disabled
// inputs). Promoted from UI 002 at its second use (UI 003's mailbox sections).
defineProps<{ items: readonly { label: string; value: string; key?: string }[] }>()
</script>

<template>
  <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
    <div v-for="item in items" :key="item.key ?? item.label" :data-value="item.key">
      <dt class="text-gray-600 dark:text-gray-400">{{ item.label }}</dt>
      <dd class="break-words text-gray-900 dark:text-white">{{ item.value }}</dd>
    </div>
  </dl>
</template>

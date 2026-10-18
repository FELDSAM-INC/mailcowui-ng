<script setup lang="ts">
// The clients a confirmation affects, by client ID, after the classic dialog's
// `footer.delete_these_items`.
defineProps<{ clientIds: readonly string[] }>()
</script>

<template>
  <ul
    data-client-list
    class="flex max-h-60 list-disc flex-col gap-0.5 overflow-y-auto ps-5 text-sm text-gray-700 dark:text-gray-300"
  >
    <li v-for="clientId in clientIds" :key="clientId" class="font-mono break-all">
      {{ clientId }}
    </li>
  </ul>
</template>

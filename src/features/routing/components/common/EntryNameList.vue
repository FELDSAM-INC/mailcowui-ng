<script setup lang="ts">
// The entries a deletion names (`#ConfirmDeleteModal` lists the affected objects), scrollable when
// long.
defineProps<{ names: readonly string[] }>()
</script>

<template>
  <ul
    data-delete-names
    class="flex max-h-60 list-disc flex-col gap-0.5 overflow-y-auto ps-5 text-sm text-gray-700 dark:text-gray-300"
  >
    <li v-for="name in names" :key="name" class="wrap-anywhere">{{ name }}</li>
  </ul>
</template>

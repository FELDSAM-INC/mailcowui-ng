<script setup lang="ts">
// The content of the deletion confirmation (#ConfirmDeleteModal, plan decision 16): legacy's
// "delete these items" text before the queue IDs to delete.
import LegacyText from '@/shared/components/LegacyText.vue'

defineProps<{ ids: readonly string[] }>()
</script>

<template>
  <div class="flex flex-col gap-2 text-gray-700 dark:text-gray-300">
    <LegacyText k="footer.delete_these_items" as="p" class="text-gray-700 dark:text-gray-300" />
    <ul data-delete-ids class="max-h-48 list-disc overflow-y-auto ps-5 font-mono">
      <li v-for="id in ids" :key="id" class="text-gray-700 dark:text-gray-300">{{ id }}</li>
    </ul>
  </div>
</template>

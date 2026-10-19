<script setup lang="ts">
// The body of a mass action's confirmation (research R16, docs/conventions.md "Confirmations"): the
// affected objects by name, scrollable when long, and the lines that say what the action does.
defineProps<{ names: readonly string[]; lines: readonly string[] }>()
</script>

<template>
  <div data-bulk-confirm class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <!-- Focusable, so that a long list scrolls from the keyboard (WCAG 2.1.1). -->
    <ul
      tabindex="0"
      class="flex max-h-60 list-disc flex-col gap-0.5 overflow-y-auto ps-5 focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <li v-for="name in names" :key="name" class="break-all text-gray-900 dark:text-white">
        {{ name }}
      </li>
    </ul>
    <p v-for="line in lines" :key="line">{{ line }}</p>
  </div>
</template>

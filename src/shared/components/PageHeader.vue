<script setup lang="ts">
// The heading of a page. Focus moves to it after navigation (FR-080), so it has tabindex="-1".
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header
    class="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
  >
    <div class="min-w-0 sm:flex-1 sm:basis-64">
      <h1
        tabindex="-1"
        class="text-2xl font-semibold wrap-anywhere text-gray-900 focus:outline-none dark:text-white"
      >
        {{ title }}
      </h1>
      <p v-if="description" class="mt-1 wrap-anywhere text-gray-600 dark:text-gray-400">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex min-w-0 max-w-full flex-wrap gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

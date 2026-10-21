<script setup lang="ts">
import { lt } from '@/i18n'

withDefaults(defineProps<{ sections?: number; fields?: number; editor?: boolean }>(), {
  sections: 1,
  fields: 3,
  editor: false,
})
</script>

<template>
  <div role="status" aria-busy="true" data-settings-loading class="min-w-0 space-y-4">
    <p>{{ lt('footer.loading') }}</p>
    <div data-loading-shape aria-hidden="true" class="space-y-4">
      <div
        v-for="section in sections"
        :key="section"
        class="min-w-0 space-y-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="h-6 w-2/5 rounded bg-gray-200 dark:bg-gray-700" />
        <div v-for="field in fields" :key="field" class="space-y-2">
          <div class="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
          <div class="h-11 w-full rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
        <div v-if="editor" class="h-52 w-full rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  </div>
</template>

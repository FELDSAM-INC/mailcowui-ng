<script setup lang="ts">
// Shared confirmation content; each feature supplies its existing pluralized keep-values text.
import { useI18n } from 'vue-i18n'

defineProps<{ names: readonly string[]; keepValuesKey: string }>()
const { t } = useI18n()
</script>

<template>
  <div data-template-delete class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <ul class="flex max-h-60 list-disc flex-col gap-0.5 overflow-y-auto ps-5">
      <li v-for="name in names" :key="name" class="break-words text-gray-700 dark:text-gray-300">
        {{ name }}
      </li>
    </ul>
    <p>{{ t(keepValuesKey, names.length) }}</p>
  </div>
</template>

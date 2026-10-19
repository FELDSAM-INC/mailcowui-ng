<script setup lang="ts">
// The values found for a check, as literal text (FR-078): markup is never rendered and control or
// direction characters are made visible; an empty list says that no record was found.
import { useI18n } from 'vue-i18n'

import { visibleText } from '../diagnostics/display'

defineProps<{ found: readonly string[] }>()
const { t } = useI18n()
</script>

<template>
  <div data-check-found class="text-sm text-gray-800 dark:text-gray-200">
    <p v-if="found.length === 0" class="text-gray-700 dark:text-gray-300">
      {{ t('dns.diagnostics.noRecord') }}
    </p>
    <ul v-else :aria-label="t('dns.diagnostics.found')" class="flex flex-col gap-1">
      <li v-for="(value, index) in found" :key="index">
        <code class="font-mono wrap-anywhere">{{ visibleText(value) }}</code>
      </li>
    </ul>
  </div>
</template>

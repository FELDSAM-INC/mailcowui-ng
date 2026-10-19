<script setup lang="ts">
// A labelled DNS value with its copy button (research R6, FR-017, FR-018): the value as monospace
// text (never markup) that wraps anywhere, so long record values never scroll sideways at 360 px;
// the copy button copies exactly the value and selects this element when the browser refuses.
import { ref } from 'vue'

import CopyButton from '@/shared/components/CopyButton.vue'

withDefaults(
  defineProps<{
    label: string
    value: string
    copyLabel: string
    multiline?: boolean
    copy?: boolean
  }>(),
  { multiline: false, copy: true },
)

const element = ref<HTMLElement | null>(null)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1">
    <span class="text-sm text-gray-600 dark:text-gray-400">{{ label }}</span>
    <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
      <pre
        v-if="multiline"
        ref="element"
        data-record-value
        class="max-h-96 min-w-0 flex-1 overflow-y-auto rounded-lg bg-gray-50 p-2 font-mono text-sm whitespace-pre-wrap wrap-anywhere text-gray-900 dark:bg-gray-950 dark:text-white"
        >{{ value }}</pre
      >
      <code
        v-else
        ref="element"
        data-record-value
        class="min-w-0 flex-1 rounded-lg bg-gray-50 p-2 font-mono text-sm wrap-anywhere text-gray-900 dark:bg-gray-950 dark:text-white"
        >{{ value }}</code
      >
      <CopyButton v-if="copy" :text="value" :label="copyLabel" :select-target="element" />
    </div>
  </div>
</template>

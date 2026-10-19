<script setup lang="ts">
// The "Name" cell of a check in the table: its purpose, the record name and a copy button for it.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CopyButton from '@/shared/components/CopyButton.vue'

defineProps<{ label: string; recordName: string }>()
const { t } = useI18n()
const element = ref<HTMLElement | null>(null)
</script>

<template>
  <span class="flex min-w-0 flex-col items-start gap-1">
    <span class="font-semibold text-gray-900 dark:text-white">{{ label }}</span>
    <code ref="element" class="font-mono text-gray-800 wrap-anywhere dark:text-gray-200">{{
      recordName
    }}</code>
    <CopyButton
      :text="recordName"
      :label="t('dns.diagnostics.copyName', { check: label })"
      :select-target="element"
      icon-only
    />
  </span>
</template>

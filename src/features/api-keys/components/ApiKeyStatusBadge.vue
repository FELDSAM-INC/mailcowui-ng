<script setup lang="ts">
// A key's status in text with an icon, never by colour alone (FR-084).
import { computed } from 'vue'

import type { ApiKeyStatus } from '@/api'
import { text } from '@/i18n'
import { CheckIcon, CloseIcon, WarningIcon } from '@/shared/icons'

const props = defineProps<{ status: ApiKeyStatus }>()

const STYLES: Record<ApiKeyStatus, string> = {
  active:
    'border-success-200 bg-success-50 text-success-800 dark:border-success-900 dark:bg-success-950 dark:text-success-200',
  expired:
    'border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100',
  revoked:
    'border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100',
}
const ICONS = { active: CheckIcon, expired: WarningIcon, revoked: CloseIcon } as const
const icon = computed(() => ICONS[props.status])
</script>

<template>
  <span
    data-status
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium"
    :class="STYLES[status]"
  >
    <component :is="icon" class="size-4" />{{ text(`enums.apiKeyStatus.${status}`) }}
  </span>
</template>

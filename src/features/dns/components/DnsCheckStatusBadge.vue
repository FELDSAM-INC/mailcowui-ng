<script setup lang="ts">
// The status of a diagnostics check as icon and text (FR-059, FR-086), coloured by its summary
// group: a problem, not verified, correct, or an optional record that is not set.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DnsCheck } from '@/api'
import { CheckIcon, CloseIcon, InfoIcon, WarningIcon } from '@/shared/icons'

import { statusLabelKey, summaryGroup } from '../diagnostics/summary-groups'

const props = defineProps<{ check: Pick<DnsCheck, 'status' | 'optional'> }>()
const { t } = useI18n()

const STYLE = {
  ok: { icon: CheckIcon, tone: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' },
  needsAttention: {
    icon: CloseIcon,
    tone: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  },
  notVerified: {
    icon: WarningIcon,
    tone: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  },
  optionalNotSet: {
    icon: InfoIcon,
    tone: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
} as const

const group = computed(() => summaryGroup(props.check.status, props.check.optional))
const style = computed(() => STYLE[group.value])
</script>

<template>
  <span
    data-check-status
    :data-status="check.status"
    :data-group="group"
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium"
    :class="style.tone"
  >
    <component :is="style.icon" class="size-4 shrink-0" />{{
      t(statusLabelKey(check.status, check.optional))
    }}
  </span>
</template>

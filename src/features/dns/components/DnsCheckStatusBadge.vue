<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

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
  ok: { icon: CheckIcon, tone: 'success' },
  needsAttention: {
    icon: CloseIcon,
    tone: 'error',
  },
  notVerified: {
    icon: WarningIcon,
    tone: 'warning',
  },
  optionalNotSet: {
    icon: InfoIcon,
    tone: 'gray',
  },
} as const

const group = computed(() => summaryGroup(props.check.status, props.check.optional))
const style = computed(() => STYLE[group.value])
</script>

<template>
  <Badge data-check-status :data-status="check.status" :data-group="group" :color="style.tone">
    <component :is="style.icon" class="size-4 shrink-0" />{{
      t(statusLabelKey(check.status, check.optional))
    }}
  </Badge>
</template>

<script setup lang="ts">
// The outcome of an audit record in text with an icon, never by colour alone (FR-084).
import type { AuditOutcome } from '@/api'
import { CheckIcon, DangerIcon } from '@/shared/icons'

import { useAuditLabels } from '../labels'

defineProps<{ outcome: AuditOutcome }>()
const { label } = useAuditLabels()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 font-medium"
    :class="
      outcome === 'failure'
        ? 'text-error-700 dark:text-error-300'
        : 'text-success-700 dark:text-success-300'
    "
  >
    <DangerIcon v-if="outcome === 'failure'" class="size-4 shrink-0" />
    <CheckIcon v-else class="size-4 shrink-0" />
    {{ label('outcome', outcome) }}
  </span>
</template>

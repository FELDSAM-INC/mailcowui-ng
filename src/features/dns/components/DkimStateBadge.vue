<script setup lang="ts">
// The state of a DKIM entry (FR-086): the classic interface's badge texts ("Key valid", "Key
// missing", "Key unused") with an icon, and "Incomplete" for a key with missing parts, which legacy
// cannot hold.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DkimKey } from '@/api'
import { text } from '@/i18n'
import { CheckIcon, CloseIcon, InfoIcon, WarningIcon } from '@/shared/icons'

const props = defineProps<{ entry: DkimKey }>()
const { t } = useI18n()

const STYLE = {
  valid: {
    icon: CheckIcon,
    tone: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
  },
  missing: { icon: CloseIcon, tone: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' },
  unused: {
    icon: InfoIcon,
    tone: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  },
} as const

const style = computed(() => STYLE[props.entry.state] ?? STYLE.unused)
const incomplete = computed(() => props.entry.key !== null && !props.entry.key.complete)
</script>

<template>
  <span class="inline-flex flex-wrap gap-1">
    <span
      data-dkim-state
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium"
      :class="style.tone"
    >
      <component :is="style.icon" class="size-4" />{{ text(`dns.dkim.states.${entry.state}`) }}
    </span>
    <span
      v-if="incomplete"
      data-dkim-incomplete
      class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <WarningIcon class="size-4" />{{ t('dns.dkim.incomplete') }}
    </span>
  </span>
</template>

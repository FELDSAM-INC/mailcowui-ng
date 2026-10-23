<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

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
    tone: 'success',
  },
  missing: { icon: CloseIcon, tone: 'error' },
  unused: {
    icon: InfoIcon,
    tone: 'warning',
  },
} as const

const style = computed(() => STYLE[props.entry.state] ?? STYLE.unused)
const incomplete = computed(() => props.entry.key !== null && !props.entry.key.complete)
</script>

<template>
  <span class="inline-flex flex-wrap gap-1">
    <Badge data-dkim-state :color="style.tone">
      <component :is="style.icon" class="size-4" />{{ text(`dns.dkim.states.${entry.state}`) }}
    </Badge>
    <Badge v-if="incomplete" data-dkim-incomplete color="warning">
      <WarningIcon class="size-4" />{{ t('dns.dkim.incomplete') }}
    </Badge>
  </span>
</template>

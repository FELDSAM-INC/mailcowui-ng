<script setup lang="ts">
import { Badge, type BadgeColor } from '@/shared/ui/badge'

// A legacy badge (priority, service, method, type): the value as text, with the badge's colour as
// an addition only (FR-034). Long values wrap.
import type { BadgeTone } from '../log-types'

defineProps<{ tone: BadgeTone }>()

const TONES: Record<BadgeTone, BadgeColor> = {
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  neutral: 'gray',
}
</script>

<template>
  <Badge data-badge :color="TONES[tone]">
    <slot />
  </Badge>
</template>

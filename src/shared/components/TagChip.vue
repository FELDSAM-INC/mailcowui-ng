<script setup lang="ts">
// A badge with a full touch target for tag filters and removable selections.
import { CloseIcon } from '@/shared/icons'
import { Badge, type BadgeColor } from '@/shared/ui/badge'
withDefaults(defineProps<{ color?: BadgeColor; removable?: boolean }>(), {
  color: 'gray',
  removable: false,
})
</script>
<template>
  <button
    type="button"
    data-tag-chip
    class="group/tag inline-flex min-h-11 min-w-11 max-w-full items-center rounded-lg text-start focus-visible:outline-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50"
  >
    <Badge :color="color" class="group-hover/tag:ring-1 group-hover/tag:ring-current">
      <slot name="icon" />
      <span class="min-w-0 wrap-anywhere"><slot /></span>
      <CloseIcon v-if="removable" />
    </Badge>
  </button>
</template>

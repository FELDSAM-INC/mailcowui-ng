<script setup lang="ts">
import { Badge, type BadgeColor } from '@/shared/ui/badge'

// The filter's action as a text badge (UI 006 FR-010, FR-079, legacy form map screen 1): legacy's
// `quarantine.rejected`, `quarantine.junk_folder` and `quarantine.rewrite_subject`; an `other`
// action shows its stored value as data (PlainText), with a neutral marker (D17). Never colour
// alone: the text is the badge.
import type { QuarantineItem } from '@/api'
import { text } from '@/i18n'
import PlainText from '@/shared/components/PlainText.vue'

defineProps<{ item: Pick<QuarantineItem, 'action' | 'filterAction'> }>()

const TONE: Record<QuarantineItem['action'], BadgeColor> = {
  rejected: 'error',
  junk: 'warning',
  subjectRewritten: 'warning',
  other: 'gray',
}
</script>

<template>
  <Badge :data-action="item.action" :color="TONE[item.action]">
    <PlainText v-if="item.action === 'other'" :value="item.filterAction" />
    <template v-else>{{ text(`enums.quarantineItemAction.${item.action}`) }}</template>
  </Badge>
</template>

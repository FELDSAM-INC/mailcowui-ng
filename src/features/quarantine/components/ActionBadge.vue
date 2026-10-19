<script setup lang="ts">
// The filter's action as a text badge (UI 006 FR-010, FR-079, legacy form map screen 1): legacy's
// `quarantine.rejected`, `quarantine.junk_folder` and `quarantine.rewrite_subject`; an `other`
// action shows its stored value as data (PlainText), with a neutral marker (D17). Never colour
// alone: the text is the badge.
import type { QuarantineItem } from '@/api'
import { text } from '@/i18n'
import PlainText from '@/shared/components/PlainText.vue'

defineProps<{ item: Pick<QuarantineItem, 'action' | 'filterAction'> }>()

const TONE: Record<QuarantineItem['action'], string> = {
  rejected: 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200',
  junk: 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  subjectRewritten: 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200',
}
</script>

<template>
  <span
    :data-action="item.action"
    class="inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-sm font-medium"
    :class="TONE[item.action]"
  >
    <PlainText v-if="item.action === 'other'" :value="item.filterAction" />
    <template v-else>{{ text(`enums.quarantineItemAction.${item.action}`) }}</template>
  </span>
</template>

<script setup lang="ts">
// The DKIM entries of one page: cards below md and a table from md up (FR-006, FR-007). Selection
// and entry action slots pass through to both layouts.
import { lt } from '@/i18n'
import type { DkimKey } from '@/api'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { DkimSort } from '../dkim/list-state'
import DkimEntryCard from './DkimEntryCard.vue'
import DkimEntryTable from './DkimEntryTable.vue'

withDefaults(
  defineProps<{
    entries: readonly DkimKey[]
    sort: DkimSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{
  sort: [sort: DkimSort, order: SortOrder]
}>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <DkimEntryTable
    :hidden="!wide"
    :entries="entries"
    :sort="sort"
    :order="order"
    :selectable="selectable"
    @sort="(key, value) => emit('sort', key, value)"
  >
    <template #select-all><slot name="select-all" /></template>
    <template #select="{ entry }"><slot name="select" :entry="entry" /></template>
    <template #actions="{ entry }"><slot name="actions" :entry="entry" /></template>
  </DkimEntryTable>
  <ul v-if="!wide" :aria-label="lt('admin.dkim_keys')" class="flex flex-col gap-3">
    <DkimEntryCard v-for="entry in entries" :key="entry.name" :entry="entry">
      <template v-if="selectable" #select><slot name="select" :entry="entry" /></template>
      <template #actions><slot name="actions" :entry="entry" /></template>
    </DkimEntryCard>
  </ul>
</template>

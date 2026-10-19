<script setup lang="ts">
// The resources of one page: cards below md and a table from md up (FR-007). The selection and
// entry action slots pass through to both layouts.
import type { Resource } from '@/api'
import { lt } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { ResourceSort } from '../list-state'
import ResourceCard from './ResourceCard.vue'
import ResourceTable from './ResourceTable.vue'

withDefaults(
  defineProps<{
    resources: readonly Resource[]
    sort: ResourceSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: ResourceSort, order: SortOrder] }>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <ResourceTable
    v-if="wide"
    :resources="resources"
    :sort="sort"
    :order="order"
    :selectable="selectable"
    @sort="(key, order) => emit('sort', key, order)"
  >
    <template #select-all><slot name="select-all" /></template>
    <template #select="{ resource }"><slot name="select" :resource="resource" /></template>
    <template #actions="{ resource }"><slot name="actions" :resource="resource" /></template>
  </ResourceTable>
  <ul v-else :aria-label="lt('mailbox.resources')" class="flex flex-col gap-3">
    <ResourceCard v-for="item in resources" :key="item.address" :resource="item">
      <template v-if="selectable" #select><slot name="select" :resource="item" /></template>
      <template #actions><slot name="actions" :resource="item" /></template>
    </ResourceCard>
  </ul>
</template>

<script setup lang="ts">
// The aliases of one page: cards below md and a table from md up (FR-007, UI 001 R21). The
// selection and entry action slots pass through to both layouts.
import type { Alias } from '@/api'
import { lt } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { AliasSort } from '../list-state'
import AliasCard from './AliasCard.vue'
import AliasTable from './AliasTable.vue'

withDefaults(
  defineProps<{
    aliases: readonly Alias[]
    sort: AliasSort
    order: SortOrder
    groupwareEnabled: boolean | undefined
    canSeeOrphaned: boolean
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: AliasSort, order: SortOrder] }>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <AliasTable
    :hidden="!wide"
    :aliases="aliases"
    :sort="sort"
    :order="order"
    :groupware-enabled="groupwareEnabled"
    :can-see-orphaned="canSeeOrphaned"
    :selectable="selectable"
    @sort="(key, order) => emit('sort', key, order)"
  >
    <template #select-all><slot name="select-all" /></template>
    <template #select="{ alias }"><slot name="select" :alias="alias" /></template>
    <template #actions="{ alias }"><slot name="actions" :alias="alias" /></template>
  </AliasTable>
  <ul v-if="!wide" :aria-label="lt('mailbox.aliases')" class="flex flex-col gap-3">
    <AliasCard
      v-for="alias in aliases"
      :key="alias.id"
      :alias="alias"
      :groupware-enabled="groupwareEnabled"
      :can-see-orphaned="canSeeOrphaned"
    >
      <template v-if="selectable" #select><slot name="select" :alias="alias" /></template>
      <template #actions><slot name="actions" :alias="alias" /></template>
    </AliasCard>
  </ul>
</template>

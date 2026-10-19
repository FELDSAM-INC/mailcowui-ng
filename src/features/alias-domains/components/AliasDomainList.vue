<script setup lang="ts">
// The domain aliases of one page: cards below md and a table from md up (FR-007). The selection
// and entry action slots pass through to both layouts.
import type { AliasDomain } from '@/api'
import { lt } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { AliasDomainSort } from '../list-state'
import AliasDomainCard from './AliasDomainCard.vue'
import AliasDomainTable from './AliasDomainTable.vue'

withDefaults(
  defineProps<{
    aliasDomains: readonly AliasDomain[]
    sort: AliasDomainSort
    order: SortOrder
    linkDomains: boolean
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: AliasDomainSort, order: SortOrder] }>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <AliasDomainTable
    v-if="wide"
    :alias-domains="aliasDomains"
    :sort="sort"
    :order="order"
    :link-domains="linkDomains"
    :selectable="selectable"
    @sort="(key, order) => emit('sort', key, order)"
  >
    <template #select-all><slot name="select-all" /></template>
    <template #select="{ aliasDomain }"
      ><slot name="select" :alias-domain="aliasDomain"
    /></template>
    <template #actions="{ aliasDomain }">
      <slot name="actions" :alias-domain="aliasDomain" />
    </template>
  </AliasDomainTable>
  <ul v-else :aria-label="lt('mailbox.domain_aliases')" class="flex flex-col gap-3">
    <AliasDomainCard
      v-for="item in aliasDomains"
      :key="item.name"
      :alias-domain="item"
      :link-domains="linkDomains"
    >
      <template v-if="selectable" #select><slot name="select" :alias-domain="item" /></template>
      <template #actions><slot name="actions" :alias-domain="item" /></template>
    </AliasDomainCard>
  </ul>
</template>

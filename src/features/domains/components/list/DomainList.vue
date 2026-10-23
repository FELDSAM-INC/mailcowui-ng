<script setup lang="ts">
// The domains of one page: cards below md and a table from md up (UI 001 R21, research D8). The
// selection and entry action slots pass through to both layouts.
import { lt } from '@/i18n'
import type { Domain } from '@/api'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { DomainSort } from '../../list-state'
import DomainCard from './DomainCard.vue'
import DomainTable from './DomainTable.vue'

withDefaults(
  defineProps<{
    domains: readonly Domain[]
    sort: DomainSort
    order: SortOrder
    canSeeDomainAdmins: boolean
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: DomainSort, order: SortOrder]; filterTag: [tag: string] }>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <DomainTable
    :hidden="!wide"
    :domains="domains"
    :sort="sort"
    :order="order"
    :can-see-domain-admins="canSeeDomainAdmins"
    :selectable="selectable"
    @sort="(key, order) => emit('sort', key, order)"
    @filter-tag="emit('filterTag', $event)"
  >
    <template #select-all><slot name="select-all" /></template>
    <template #select="{ domain }"><slot name="select" :domain="domain" /></template>
    <template #actions="{ domain }"><slot name="actions" :domain="domain" /></template>
  </DomainTable>
  <ul v-if="!wide" :aria-label="lt('mailbox.domains')" class="flex flex-col gap-3">
    <DomainCard
      v-for="domain in domains"
      :key="domain.name"
      :domain="domain"
      :can-see-domain-admins="canSeeDomainAdmins"
      @filter-tag="emit('filterTag', $event)"
    >
      <template v-if="selectable" #select><slot name="select" :domain="domain" /></template>
      <template #actions><slot name="actions" :domain="domain" /></template>
    </DomainCard>
  </ul>
</template>

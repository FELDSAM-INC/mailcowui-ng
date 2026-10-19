<script setup lang="ts">
// The sort control of the resource cards (FR-043): every sort key of the contract and the order,
// labelled with the columns' legacy keys. Wide screens sort from the table headers.
import { useI18n } from 'vue-i18n'

import { componentsParametersResourceSortValues } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import type { ResourceSort } from '../list-state'

const props = defineProps<{ sort: ResourceSort; order: SortOrder }>()
const emit = defineEmits<{ change: [sort: ResourceSort, order: SortOrder | undefined] }>()
const { t } = useI18n()

const LABELS: Record<ResourceSort, LegacyKey> = {
  description: 'mailbox.description',
  address: 'mailbox.alias',
  kind: 'mailbox.kind',
  domain: 'mailbox.domain',
  bookingRule: 'mailbox.multiple_bookings',
  active: 'mailbox.active',
  createdAt: 'edit.created_on',
  modifiedAt: 'edit.last_modified',
}
const SELECT =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <div class="flex flex-col gap-1.5">
      <label for="resource-sort" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('lists.sort.label') }}
      </label>
      <select
        id="resource-sort"
        :value="sort"
        :class="SELECT"
        @change="
          emit('change', ($event.target as HTMLSelectElement).value as ResourceSort, undefined)
        "
      >
        <option v-for="key in componentsParametersResourceSortValues" :key="key" :value="key">
          {{ lt(LABELS[key]) }}
        </option>
      </select>
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="resource-order" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('lists.sort.order') }}
      </label>
      <select
        id="resource-order"
        :value="order"
        :class="SELECT"
        @change="
          emit('change', props.sort, ($event.target as HTMLSelectElement).value as SortOrder)
        "
      >
        <option value="asc">{{ t('lists.sort.asc') }}</option>
        <option value="desc">{{ t('lists.sort.desc') }}</option>
      </select>
    </div>
  </div>
</template>

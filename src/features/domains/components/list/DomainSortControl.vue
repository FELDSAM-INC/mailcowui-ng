<script setup lang="ts">
// The sort control (FR-011): every sort key of the contract and the order, on every width.
import { useI18n } from 'vue-i18n'

import { text } from '@/i18n'
import { componentsParametersDomainSortValues } from '@/api'
import type { SortOrder } from '@/shared/composables/useListState'

import type { DomainSort } from '../../list-state'

const props = defineProps<{ sort: DomainSort; order: SortOrder }>()
const KEYS = componentsParametersDomainSortValues
const emit = defineEmits<{ change: [sort: DomainSort, order: SortOrder] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <div class="flex flex-col gap-1.5">
      <label for="domain-sort" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('lists.sort.label') }}
      </label>
      <select
        id="domain-sort"
        :value="sort"
        class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @change="
          emit('change', ($event.target as HTMLSelectElement).value as DomainSort, props.order)
        "
      >
        <option v-for="key in KEYS" :key="key" :value="key">
          {{ text(`domains.sort.${key}`) }}
        </option>
      </select>
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="domain-order" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('lists.sort.order') }}
      </label>
      <select
        id="domain-order"
        :value="order"
        class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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

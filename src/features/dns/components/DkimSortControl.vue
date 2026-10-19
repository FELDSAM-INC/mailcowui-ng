<script setup lang="ts">
// The sort control of the DKIM list (FR-010): every sort key of the contract and the order, for
// the card layout below md (the table sorts by its headers).
import { useI18n } from 'vue-i18n'

import { componentsParametersDkimKeySortValues } from '@/api'
import { text } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import type { DkimSort } from '../dkim/list-state'

const props = defineProps<{ sort: DkimSort; order: SortOrder }>()
const emit = defineEmits<{ change: [sort: DkimSort, order: SortOrder] }>()
const { t } = useI18n()
const SELECT =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <div class="flex flex-col gap-1.5">
      <label for="dkim-sort" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('dns.common.sort.label') }}
      </label>
      <select
        id="dkim-sort"
        :value="sort"
        :class="SELECT"
        @change="
          emit('change', ($event.target as HTMLSelectElement).value as DkimSort, props.order)
        "
      >
        <option v-for="key in componentsParametersDkimKeySortValues" :key="key" :value="key">
          {{ text(`dns.dkim.sort.${key}`) }}
        </option>
      </select>
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="dkim-order" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('dns.common.sort.order') }}
      </label>
      <select
        id="dkim-order"
        :value="order"
        :class="SELECT"
        @change="
          emit('change', props.sort, ($event.target as HTMLSelectElement).value as SortOrder)
        "
      >
        <option value="asc">{{ t('dns.common.sort.asc') }}</option>
        <option value="desc">{{ t('dns.common.sort.desc') }}</option>
      </select>
    </div>
  </div>
</template>

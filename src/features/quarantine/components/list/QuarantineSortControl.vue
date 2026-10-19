<script setup lang="ts">
// The sort control below md (UI 006 FR-014, legacy form map screen 1), where the table's sortable
// headers are not shown: the ten sort fields of the contract, labelled with legacy's column keys
// (`quarantineUi.sort.*` through `LEGACY_TEXTS`; the identifier is `lists.id`), and the order.
import { useI18n } from 'vue-i18n'

import { componentsParametersQuarantineItemSortValues } from '@/api'
import { text } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import type { QuarantineSort } from '../../list-state'

const props = defineProps<{ sort: QuarantineSort; order: SortOrder }>()
const emit = defineEmits<{ change: [sort: QuarantineSort, order: SortOrder] }>()
const { t } = useI18n()

const label = (key: QuarantineSort) => (key === 'id' ? t('lists.id') : text(`quarantineUi.sort.${key}`))

const SELECT =
  'h-11 max-w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div data-sort-control class="flex min-w-0 flex-wrap gap-3">
    <div class="flex min-w-0 flex-col gap-1.5">
      <label for="quarantine-sort" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('lists.sort.label') }}
      </label>
      <select
        id="quarantine-sort"
        :value="sort"
        :class="SELECT"
        @change="
          emit('change', ($event.target as HTMLSelectElement).value as QuarantineSort, props.order)
        "
      >
        <option v-for="key in componentsParametersQuarantineItemSortValues" :key="key" :value="key">
          {{ label(key) }}
        </option>
      </select>
    </div>
    <div class="flex min-w-0 flex-col gap-1.5">
      <label for="quarantine-order" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('lists.sort.order') }}
      </label>
      <select
        id="quarantine-order"
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

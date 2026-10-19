<script setup lang="ts">
// The sort control below md (FR-010), where the table's sortable headers are not shown: the 12
// sort fields of the contract, labelled with legacy's column keys (`mailboxes.sort.*` through
// `LEGACY_TEXTS`), and the order. UI 002's sort labels name the two selects.
import { useI18n } from 'vue-i18n'

import { componentsParametersMailboxSortValues } from '@/api'
import { text } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import { sortLabelKey, type MailboxSort } from '../../labels'

const props = defineProps<{ sort: MailboxSort; order: SortOrder }>()
const emit = defineEmits<{ change: [sort: MailboxSort, order: SortOrder] }>()
const { t } = useI18n()

const SELECT =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div data-sort-control class="flex flex-wrap gap-3">
    <div class="flex min-w-0 flex-col gap-1.5">
      <label for="mailbox-sort" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('domains.sort.label') }}
      </label>
      <select
        id="mailbox-sort"
        :value="sort"
        :class="SELECT"
        @change="
          emit('change', ($event.target as HTMLSelectElement).value as MailboxSort, props.order)
        "
      >
        <option v-for="key in componentsParametersMailboxSortValues" :key="key" :value="key">
          {{ text(sortLabelKey(key)) }}
        </option>
      </select>
    </div>
    <div class="flex min-w-0 flex-col gap-1.5">
      <label for="mailbox-order" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('domains.sort.order') }}
      </label>
      <select
        id="mailbox-order"
        :value="order"
        :class="SELECT"
        @change="
          emit('change', props.sort, ($event.target as HTMLSelectElement).value as SortOrder)
        "
      >
        <option value="asc">{{ t('domains.sort.asc') }}</option>
        <option value="desc">{{ t('domains.sort.desc') }}</option>
      </select>
    </div>
  </div>
</template>

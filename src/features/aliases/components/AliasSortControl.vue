<script setup lang="ts">
// Every alias sort key stays available, including secondary fields shown in expandable rows.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { componentsParametersAliasSortValues } from '@/api'
import { legacy, resolveText, type TextRef } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import type { AliasSort } from '../list-state'

const props = defineProps<{
  sort: AliasSort
  order: SortOrder
  groupwareEnabled: boolean | undefined
}>()
const emit = defineEmits<{ change: [sort: AliasSort, order: SortOrder | undefined] }>()
const { t } = useI18n()

const LABELS: Record<AliasSort, TextRef> = {
  id: 'lists.id',
  address: legacy('mailbox.alias'),
  domain: legacy('mailbox.domain'),
  active: legacy('mailbox.active'),
  groupwareVisible: legacy('mailbox.sogo_visible'),
  internal: legacy('mailbox.internal'),
  senderAllowed: legacy('edit.sender_allowed'),
  createdAt: legacy('edit.created_on'),
  modifiedAt: legacy('edit.last_modified'),
}
const keys = computed(() =>
  componentsParametersAliasSortValues.filter(
    (key) => key !== 'groupwareVisible' || props.groupwareEnabled,
  ),
)
const SELECT =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <div class="flex flex-col gap-1.5">
      <label for="alias-sort" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('lists.sort.label') }}
      </label>
      <select
        id="alias-sort"
        :value="sort"
        :class="SELECT"
        @change="emit('change', ($event.target as HTMLSelectElement).value as AliasSort, undefined)"
      >
        <option v-for="key in keys" :key="key" :value="key">
          {{ resolveText(LABELS[key], t) }}
        </option>
      </select>
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="alias-order" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('lists.sort.order') }}
      </label>
      <select
        id="alias-order"
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

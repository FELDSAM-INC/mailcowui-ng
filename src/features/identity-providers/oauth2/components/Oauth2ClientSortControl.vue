<script setup lang="ts">
// The sort control of the OAuth2 list (FR-054): by the classic columns ID, Client ID and Redirect
// URI, and the order, on every width. The labels "Sort by", "Order", "Ascending" and "Descending"
// are UI 002's list texts.
import { useI18n } from 'vue-i18n'

import { componentsParametersOauth2ClientSortValues } from '@/api'
import { resolveText } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import { SORT_LABELS } from '../columns'
import type { Oauth2ClientSort } from '../list-state'

const props = defineProps<{ sort: Oauth2ClientSort; order: SortOrder }>()
const emit = defineEmits<{ change: [sort: Oauth2ClientSort, order: SortOrder] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <div class="flex flex-col gap-1.5">
      <label for="oauth2-sort" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('domains.sort.label') }}
      </label>
      <select
        id="oauth2-sort"
        :value="sort"
        class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @change="
          emit(
            'change',
            ($event.target as HTMLSelectElement).value as Oauth2ClientSort,
            props.order,
          )
        "
      >
        <option v-for="key in componentsParametersOauth2ClientSortValues" :key="key" :value="key">
          {{ resolveText(SORT_LABELS[key], t) }}
        </option>
      </select>
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="oauth2-order" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('domains.sort.order') }}
      </label>
      <select
        id="oauth2-order"
        :value="order"
        class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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

<script setup lang="ts">
// The sort control of the mailbox template list (FR-058): name, ID, creation and modification
// time, and the order, on every width (UI 002's labels, legacy's where it has them).
import { useI18n } from 'vue-i18n'

import { componentsParametersMailboxTemplateSortValues } from '@/api'
import { text } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import type { TemplateSort } from '../../templates/list-state'

const props = defineProps<{ sort: TemplateSort; order: SortOrder }>()
const emit = defineEmits<{ change: [sort: TemplateSort, order: SortOrder] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <div class="flex flex-col gap-1.5">
      <label for="template-sort" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('domains.sort.label') }}
      </label>
      <select
        id="template-sort"
        :value="sort"
        class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @change="
          emit('change', ($event.target as HTMLSelectElement).value as TemplateSort, props.order)
        "
      >
        <option
          v-for="key in componentsParametersMailboxTemplateSortValues"
          :key="key"
          :value="key"
        >
          {{ text(`domainTemplates.sort.${key}`) }}
        </option>
      </select>
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="template-order" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ t('domains.sort.order') }}
      </label>
      <select
        id="template-order"
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

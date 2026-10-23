<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import FilterPanel from '@/shared/components/FilterPanel.vue'

import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import SearchField from '@/shared/components/SearchField.vue'

import type { useRuleListState } from '../../rule-list-state'
defineProps<{ list: ReturnType<typeof useRuleListState> }>()
const { t } = useI18n()
</script>
<template>
  <ListToolbar
    ><template #select><slot name="select" /></template
    ><template #filters
      ><FilterPanel
        id="system-settings-components-spam-RuleFilters"
        :active-count="list.activeFilters.value.filter((item) => item !== 'q').length"
        immediate
        ><label class="flex min-h-11 flex-col gap-1 text-sm text-gray-800 dark:text-gray-100"
          >{{ lt('admin.active')
          }}<select
            class="form-control"
            :value="list.state.value.filters.active ?? ''"
            @change="
              list.setFilter(
                'active',
                (($event.target as HTMLSelectElement).value || undefined) as
                  'yes' | 'no' | undefined,
              )
            "
          >
            <option value="">{{ t('lists.filters.all') }}</option>
            <option value="yes">{{ t('lists.filters.yes') }}</option>
            <option value="no">{{ t('lists.filters.no') }}</option>
          </select></label
        ></FilterPanel
      ></template
    ><template #search
      ><SearchField
        id="rule-search"
        :label="lt('datatables.search')"
        :model-value="list.state.value.filters.q ?? ''"
        @search="list.setFilter('q', $event || undefined, { typing: true })" /></template
  ></ListToolbar>
</template>

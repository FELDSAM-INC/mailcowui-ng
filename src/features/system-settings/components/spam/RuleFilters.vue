<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { componentsParametersRspamdSettingsRuleSortValues } from '@/api'
import { lt } from '@/i18n'
import SearchField from '@/shared/components/SearchField.vue'
import { buttonVariants } from '@/shared/ui/button'
import type { useRuleListState, RuleSort } from '../../rule-list-state'
defineProps<{ list: ReturnType<typeof useRuleListState> }>()
const { t } = useI18n()
const label = (value: RuleSort) =>
  value === 'id'
    ? t('lists.id')
    : lt(
        value === 'description'
          ? 'admin.rsetting_desc'
          : value === 'active'
            ? 'admin.active'
            : value === 'createdAt'
              ? 'mailbox.created_on'
              : 'mailbox.last_modified',
      )
</script>
<template>
  <SearchField
    id="rule-search"
    :label="lt('datatables.search')"
    :model-value="list.state.value.filters.q ?? ''"
    @search="list.setFilter('q', $event || undefined, { typing: true })"
  />
  <div class="flex flex-wrap items-end gap-3">
    <label class="flex min-h-11 flex-col gap-1 text-sm"
      >{{ lt('admin.active')
      }}<select
        class="form-control"
        :value="list.state.value.filters.active ?? ''"
        @change="
          list.setFilter(
            'active',
            (($event.target as HTMLSelectElement).value || undefined) as 'yes' | 'no' | undefined,
          )
        "
      >
        <option value="">{{ t('lists.filters.all') }}</option>
        <option value="yes">{{ t('lists.filters.yes') }}</option>
        <option value="no">{{ t('lists.filters.no') }}</option>
      </select></label
    >
    <label class="flex min-h-11 flex-col gap-1 text-sm"
      >{{ t('lists.sort.label')
      }}<select
        class="form-control"
        :value="list.state.value.sort"
        @change="list.setSort(($event.target as HTMLSelectElement).value as RuleSort)"
      >
        <option
          v-for="sort in componentsParametersRspamdSettingsRuleSortValues"
          :key="sort"
          :value="sort"
        >
          {{ label(sort) }}
        </option>
      </select></label
    >
    <button
      type="button"
      :class="buttonVariants({ variant: 'outline' })"
      @click="
        list.setSort(
          list.state.value.sort ?? 'id',
          list.state.value.order === 'asc' ? 'desc' : 'asc',
        )
      "
    >
      {{ t(list.state.value.order === 'asc' ? 'lists.sort.asc' : 'lists.sort.desc') }}
    </button>
  </div>
</template>

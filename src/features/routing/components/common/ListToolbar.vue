<script setup lang="ts">
import UnifiedListToolbar from '@/shared/components/ListToolbar.vue'
import FilterPanel from '@/shared/components/FilterPanel.vue'

// Search, filters and sorting of a routing list (research R4, FR-007): the search field (legacy's
// `datatables.search`), then the filters and the sort behind one control below md and inline from
// md up, and the active filters as removable chips with "clear all". Everything is written to the
// page address through the list state.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import ActiveFilterChips, { type FilterChip } from '@/shared/components/ActiveFilterChips.vue'
import SearchField from '@/shared/components/SearchField.vue'

import { valueText } from '../../logic/changed-fields'
import type { FilterDef, SortChoice } from './entry-list'

const props = defineProps<{
  idPrefix: string
  filters: readonly FilterDef[]
  sorts: readonly SortChoice[]
  values: Readonly<Record<string, unknown>>
  search: string
  sort: string
  order: 'asc' | 'desc'
}>()
const emit = defineEmits<{
  search: [value: string]
  filter: [key: string, value: unknown]
  sort: [sort: string, order: 'asc' | 'desc']
  clear: []
}>()
const { t } = useI18n()
const panelId = useId()

const SELECT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'

const selected = (key: string) => {
  const value = props.values[key]
  return Array.isArray(value) ? (value as string[]) : []
}

function toggleCheck(key: string, value: string, checked: boolean) {
  const current = selected(key)
  emit('filter', key, checked ? [...current, value] : current.filter((item) => item !== value))
}

const chips = computed<FilterChip[]>(() =>
  props.filters.flatMap((filter) => {
    const value = props.values[filter.key]
    if (value === undefined || (Array.isArray(value) && value.length === 0)) return []
    if (filter.kind === 'text') {
      return [{ key: filter.key, label: `${filter.label}: ${valueText(value)}` }]
    }
    if (filter.kind === 'textList') {
      return [{ key: filter.key, label: `${filter.label}: ${(value as string[]).join(', ')}` }]
    }
    const label = (item: string) =>
      filter.options.find((option) => option.value === item)?.label ?? item
    const text = Array.isArray(value) ? value.map(label).join(', ') : label(valueText(value))
    return [{ key: filter.key, label: `${filter.label}: ${text}` }]
  }),
)

function removeChip(key: string) {
  emit('filter', key, Array.isArray(props.values[key]) ? [] : undefined)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <UnifiedListToolbar
      ><template #select><slot name="select" /></template
      ><template #filters
        ><FilterPanel :id="panelId" :active-count="chips.length" immediate
          ><template v-for="filter in filters" :key="filter.key">
            <div v-if="filter.kind === 'select'" class="flex flex-col gap-1.5 md:w-48">
              <label
                :for="`${idPrefix}-filter-${filter.key}`"
                class="text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {{ filter.label }}
              </label>
              <select
                :id="`${idPrefix}-filter-${filter.key}`"
                :value="values[filter.key] ?? ''"
                :class="SELECT"
                @change="
                  emit(
                    'filter',
                    filter.key,
                    ($event.target as HTMLSelectElement).value || undefined,
                  )
                "
              >
                <option value="">{{ t('routing.filters.any') }}</option>
                <option v-for="option in filter.options" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <fieldset v-else-if="filter.kind === 'checks'" class="flex min-w-0 flex-col gap-1">
              <legend class="text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ filter.label }}
              </legend>
              <div class="flex flex-wrap gap-x-4">
                <label
                  v-for="option in filter.options"
                  :key="option.value"
                  class="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
                >
                  <input
                    type="checkbox"
                    class="size-5 accent-accent"
                    :checked="selected(filter.key).includes(option.value)"
                    @change="
                      toggleCheck(
                        filter.key,
                        option.value,
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  <span class="wrap-anywhere">{{ option.label }}</span>
                </label>
              </div>
            </fieldset>
            <div v-else-if="filter.kind === 'textList'" class="flex flex-col gap-1.5 md:w-64">
              <label
                :for="`${idPrefix}-filter-${filter.key}`"
                class="text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {{ filter.label }}
              </label>
              <input
                :id="`${idPrefix}-filter-${filter.key}`"
                type="text"
                :value="selected(filter.key)[0] ?? ''"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                class="form-control"
                @change="
                  emit(
                    'filter',
                    filter.key,
                    ($event.target as HTMLInputElement).value.trim()
                      ? [($event.target as HTMLInputElement).value.trim()]
                      : [],
                  )
                "
              />
            </div>
            <div v-else class="flex flex-col gap-1.5 md:w-64">
              <label
                :for="`${idPrefix}-filter-${filter.key}`"
                class="text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {{ filter.label }}
              </label>
              <input
                :id="`${idPrefix}-filter-${filter.key}`"
                type="text"
                :value="values[filter.key] ?? ''"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                class="form-control"
                @change="
                  emit(
                    'filter',
                    filter.key,
                    ($event.target as HTMLInputElement).value.trim() || undefined,
                  )
                "
              />
            </div> </template></FilterPanel></template
      ><template #search
        ><SearchField
          :id="`${idPrefix}-search`"
          :label="lt('datatables.search')"
          :model-value="search"
          :delay="300"
          @search="(value) => emit('search', value)" /></template></UnifiedListToolbar
    ><ActiveFilterChips :chips="chips" @remove="removeChip" @clear="emit('clear')" />
  </div>
</template>

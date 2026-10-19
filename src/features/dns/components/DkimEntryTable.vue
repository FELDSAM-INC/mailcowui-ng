<script setup lang="ts">
// DKIM entries as a table from md up (FR-007): header cells with `aria-sort` and sort buttons for
// the name, state, selector and key length; the kind; slots for selection and entry actions.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { DkimKey } from '@/api'
import { lt, text } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { ChevronDownIcon } from '@/shared/icons'

import type { DkimSort } from '../dkim/list-state'
import { dkimKeyLocation } from '../names'
import DkimKindLabel from './DkimKindLabel.vue'
import DkimStateBadge from './DkimStateBadge.vue'

const props = withDefaults(
  defineProps<{
    entries: readonly DkimKey[]
    sort: DkimSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{
  sort: [sort: DkimSort, order: SortOrder]
  filterSelector: [selector: string]
}>()
const { t, locale } = useI18n()

const COLUMNS: { key: DkimSort | 'kind'; sortable: boolean }[] = [
  { key: 'name', sortable: true },
  { key: 'kind', sortable: false },
  { key: 'state', sortable: true },
  { key: 'selector', sortable: true },
  { key: 'keyLength', sortable: true },
]

const header = (key: DkimSort | 'kind') =>
  key === 'kind' ? t('dns.dkim.filters.kind') : text(`dns.dkim.sort.${key}`)

function ariaSort(key: DkimSort | 'kind') {
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function onSort(key: DkimSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const number = (value: number | null) =>
  value === null ? '–' : formatNumber(value, locale.value as AppLocale)
</script>

<template>
  <div class="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
    <table class="w-full table-fixed text-start text-sm">
      <thead class="bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <tr>
          <th v-if="selectable" scope="col" class="w-14 px-3 py-2"><slot name="select-all" /></th>
          <th
            v-for="column in COLUMNS"
            :key="column.key"
            scope="col"
            class="px-3 py-2 text-start font-medium"
            :class="column.key === 'name' ? 'w-1/3' : ''"
            :aria-sort="column.sortable ? ariaSort(column.key) : undefined"
          >
            <button
              v-if="column.sortable"
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start"
              @click="onSort(column.key as DkimSort)"
            >
              {{ header(column.key) }}
              <ChevronDownIcon
                v-if="column.key === sort"
                class="size-4"
                :class="order === 'asc' ? 'rotate-180' : ''"
              />
            </button>
            <template v-else>{{ header(column.key) }}</template>
          </th>
          <th scope="col" class="w-16 px-3 py-2">
            <span class="sr-only">{{ t('dns.dkim.list.actions') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
        <tr v-for="entry in entries" :key="entry.name" class="align-top">
          <td v-if="selectable" class="px-3 py-2"><slot name="select" :entry="entry" /></td>
          <td class="px-3 py-2 font-medium text-gray-900 dark:text-white">
            <RouterLink
              :to="dkimKeyLocation(entry.name)"
              class="underline-offset-2 hover:underline focus-visible:underline"
            >
              <DomainNameText :name="entry.name" :unicode-name="entry.displayName" />
            </RouterLink>
          </td>
          <td class="px-3 py-2 text-gray-800 dark:text-gray-200">
            <DkimKindLabel :entry="entry" />
          </td>
          <td class="px-3 py-2"><DkimStateBadge :entry="entry" /></td>
          <td class="px-3 py-2 font-mono break-all text-gray-900 dark:text-white">
            <button
              v-if="entry.key?.selector"
              type="button"
              data-filter-selector
              class="min-h-11 text-start underline underline-offset-2"
              :aria-label="t('dns.dkim.filters.bySelector', { selector: entry.key.selector })"
              @click="emit('filterSelector', entry.key.selector)"
            >
              {{ entry.key.selector }}
            </button>
            <span v-else>–</span>
          </td>
          <td class="px-3 py-2 text-gray-900 dark:text-white">
            {{ number(entry.key?.keyLength ?? null) }}
            <span class="sr-only">{{ lt('admin.dkim_key_length') }}</span>
          </td>
          <td class="px-3 py-2"><slot name="actions" :entry="entry" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

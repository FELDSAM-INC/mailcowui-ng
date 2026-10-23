<script setup lang="ts">
import DataRow from '@/shared/components/DataRow.vue'

import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

// DKIM entries as a table from md up (FR-007): header cells with `aria-sort` and sort buttons for
// the name, state, selector and key length; the kind; slots for selection and entry actions.
import { useI18n } from 'vue-i18n'

import type { DkimKey } from '@/api'
import { lt, text } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import RowControls from '@/shared/components/RowControls.vue'
import RowAction from '@/shared/components/RowAction.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import type { DkimSort } from '../dkim/list-state'
import { dkimKeyLocation } from '../names'
import DkimKindLabel from './DkimKindLabel.vue'
import DkimStateBadge from './DkimStateBadge.vue'

const props = withDefaults(
  defineProps<{
    hidden?: boolean
    entries: readonly DkimKey[]
    sort: DkimSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{
  sort: [sort: DkimSort, order: SortOrder]
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

function onSort(key: DkimSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const number = (value: number | null) =>
  value === null ? '–' : formatNumber(value, locale.value as AppLocale)

const tableView = useDataColumns(
  () =>
    COLUMNS.map((column) => ({
      id: column.key,
      label: header(column.key),
      sort: column.sortable ? column.key : undefined,
    })),
  () => ({
    key: props.sort,
    order: props.order,
    change: (key) => onSort(key as Parameters<typeof onSort>[0]),
  }),
)
</script>

<template>
  <div v-if="!hidden" class="table-frame">
    <table class="data-table w-full table-fixed text-start text-sm">
      <thead>
        <tr>
          <th v-if="selectable" scope="col" class="w-14 px-3 py-2"><slot name="select-all" /></th>
          <DataTableHeader
            v-for="column in COLUMNS"
            :key="column.key"
            :column="String(column.key)"
            class="px-3 py-2 text-start"
            :class="column.key === 'name' ? 'w-1/3' : ''"
          />
          <th scope="col" class="table-controls-cell px-3 py-2">
            <span class="sr-only">{{ lt('mailbox.action') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <DataRow
          v-for="entry in entries"
          :key="entry.name"
          :to="dkimKeyLocation(entry.name)"
          :label="entry.name"
          :data-entry="entry.name"
          class="align-top"
        >
          <td v-if="selectable" class="px-3 py-2"><slot name="select" :entry="entry" /></td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[0]!.id))"
            :data-column="String(tableView.columns.value[0]!.id)"
            class="px-3 py-2 font-medium text-gray-900 dark:text-white"
          >
            <span class="font-medium wrap-anywhere"
              ><DomainNameText :name="entry.name" :unicode-name="entry.displayName"
            /></span>
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[1]!.id))"
            :data-column="String(tableView.columns.value[1]!.id)"
            class="px-3 py-2 text-gray-800 dark:text-gray-200"
          >
            <DkimKindLabel :entry="entry" />
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[2]!.id))"
            :data-column="String(tableView.columns.value[2]!.id)"
            class="px-3 py-2"
          >
            <DkimStateBadge :entry="entry" />
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[3]!.id))"
            :data-column="String(tableView.columns.value[3]!.id)"
            class="px-3 py-2 font-mono break-all text-gray-900 dark:text-white"
          >
            <span v-if="entry.key?.selector" data-filter-selector class="wrap-anywhere">{{
              entry.key.selector
            }}</span>
            <span v-else>–</span>
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[4]!.id))"
            :data-column="String(tableView.columns.value[4]!.id)"
            class="px-3 py-2 text-gray-900 dark:text-white"
          >
            {{ number(entry.key?.keyLength ?? null) }}
            <span class="sr-only">{{ lt('admin.dkim_key_length') }}</span>
          </td>
          <td class="table-controls-cell px-3 py-2">
            <RowControls>
              <slot name="actions" :entry="entry">
                <RowAction
                  :menu="false"
                  :label="lt('mailbox.edit')"
                  :aria-label="`${lt('mailbox.edit')}: ${entry.displayName}`"
                  :to="dkimKeyLocation(entry.name)"
                />
              </slot>
            </RowControls>
          </td>
        </DataRow>
      </tbody>
    </table>
  </div>
</template>

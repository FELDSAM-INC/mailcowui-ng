<script setup lang="ts">
import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
// The entries of a log (FR-031 to FR-033, FR-085; plan decisions 6 and 12): cards below md and a
// table from md, with legacy's columns in legacy's order. On a card, the first line holds the time
// and the entry's class or source, the main text follows, and the other values are its details; in
// the table, legacy's hidden columns are the details. Details open in place (Expand All and
// Collapse All set them all). The time column's header sorts newest or oldest first (`aria-sort`).
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { resolveText, type TextRef } from '@/i18n'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import type { LogColumn, LogEntry, LogTypeDescriptor } from '../log-types'
import { stripeClass } from './hash-stripe'
import LogCellView from './LogCellView.vue'

const props = defineProps<{
  type: LogTypeDescriptor
  /** The log's name, for the table caption. */
  title: string
  entries: readonly LogEntry[]
  expanded: ReadonlySet<string>
  wide: boolean
  order: SortOrder
}>()
const emit = defineEmits<{
  toggle: [id: string]
  reset: [hash: string]
  sort: [order: SortOrder]
}>()
const { t } = useI18n()
const listId = useId()

const label = (ref: TextRef) => resolveText(ref, t)
const byKey = computed(() => new Map(props.type.columns.map((column) => [column.key, column])))
const striped = computed(() => byKey.value.has('stripe'))
const action = computed(() => byKey.value.get('action'))

const visible = (column: LogColumn) => column.key !== 'stripe' && column.key !== 'action'
const tableColumns = computed(() => props.type.columns.filter((c) => visible(c) && !c.detail))
const tableDetails = computed(() => props.type.columns.filter((c) => visible(c) && c.detail))
const hasControls = computed(() => tableDetails.value.length > 0 || !!action.value)
const cardHead = computed(() =>
  props.type.card.head.map((key) => byKey.value.get(key)).filter((c): c is LogColumn => !!c),
)
const cardBody = computed(() => byKey.value.get(props.type.card.body))
const cardDetails = computed(() =>
  props.type.columns.filter(
    (column) =>
      visible(column) &&
      !props.type.card.head.includes(column.key) &&
      column.key !== props.type.card.body,
  ),
)

function hashOf(entry: LogEntry): string | null {
  return 'rateLimitHash' in entry ? entry.rateLimitHash : null
}

function stripe(entry: LogEntry): string {
  return striped.value ? `border-s-4 ${stripeClass(hashOf(entry))}` : ''
}

const detailsId = (entry: LogEntry) => `${listId}-${entry.id}`

const tableView = useDataColumns(
  () =>
    tableColumns.value.map((column) => ({
      id: column.key,
      label: label(column.label),
      sort: column.key === 'time' ? 'time' : undefined,
    })),
  () => ({ key: 'time', order: props.order, change: (_key, order) => emit('sort', order) }),
)
</script>

<template>
  <ul v-if="!wide" data-log-cards class="flex flex-col gap-3">
    <DataCard
      v-for="entry in entries"
      :key="entry.id"
      :data-entry="entry.id"
      :class="stripe(entry)"
      :expanded="expanded.has(entry.id)"
      :details-id="detailsId(entry)"
      :details-label="t('auditLog.details.show')"
      @update:expanded="emit('toggle', entry.id)"
    >
      <template #title>
        <span class="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-700 dark:text-gray-300">
          <span
            v-for="column in cardHead"
            :key="column.key"
            class="min-w-0"
            :data-cell="column.key"
          >
            <span class="sr-only">{{ `${label(column.label)}: ` }}</span>
            <LogCellView :cell="column.cell(entry)" />
          </span>
        </span>
      </template>
      <template v-if="action" #actions>
        <LogCellView :cell="action.cell(entry)" @reset="(hash) => emit('reset', hash)" />
      </template>
      <div
        v-if="cardBody"
        class="mt-2 min-w-0 text-gray-900 dark:text-white"
        :data-cell="cardBody.key"
      >
        <LogCellView :cell="cardBody.cell(entry)" />
      </div>
      <template v-if="cardDetails.length" #details>
        <DataCardFields data-details>
          <div v-for="column in cardDetails" :key="column.key" class="min-w-0">
            <dt class="text-xs font-medium text-gray-600 dark:text-gray-400">
              {{ label(column.label) }}
            </dt>
            <dd class="text-gray-900 dark:text-white" :data-cell="column.key">
              <LogCellView :cell="column.cell(entry)" />
            </dd>
          </div>
        </DataCardFields>
      </template>
    </DataCard>
  </ul>

  <div v-else class="table-frame">
    <table
      data-log-table
      class="data-table w-full table-fixed text-sm"
      :style="action ? { '--table-controls-width': '12rem' } : undefined"
    >
      <caption class="sr-only">
        {{
          title
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <DataTableHeader v-for="column in tableColumns" :key="column.key" :column="column.key" />
          <th v-if="hasControls" scope="col" class="table-controls-cell px-2 py-2 text-end">
            {{ action ? label(action.label) : t('domains.list.details') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="entry in entries" :key="entry.id">
          <tr :data-entry="entry.id" class="align-top text-gray-900 dark:text-white">
            <td
              v-for="(column, index) in tableColumns"
              v-show="tableView.visible(column.key)"
              :key="column.key"
              :data-column="column.key"
              class="min-w-0 px-2 py-2 wrap-anywhere"
              :class="index === 0 ? stripe(entry) : ''"
              :data-cell="column.key"
            >
              <LogCellView :cell="column.cell(entry)" />
            </td>
            <td v-if="hasControls" class="table-controls-cell px-2 py-2 text-end">
              <RowControls
                :expanded="tableDetails.length > 0 ? expanded.has(entry.id) : undefined"
                :controls="expanded.has(entry.id) ? detailsId(entry) : undefined"
                :label="
                  expanded.has(entry.id) ? t('auditLog.details.hide') : t('auditLog.details.show')
                "
                @toggle="emit('toggle', entry.id)"
              >
                <LogCellView
                  v-if="action"
                  :cell="action.cell(entry)"
                  @reset="(hash) => emit('reset', hash)"
                />
              </RowControls>
            </td>
          </tr>
          <tr v-if="tableDetails.length > 0 && expanded.has(entry.id)" :id="detailsId(entry)">
            <td :colspan="tableView.visibleCount.value + (hasControls ? 1 : 0)" class="px-2 py-2">
              <dl data-details class="grid gap-2 sm:grid-cols-2">
                <div v-for="column in tableDetails" :key="column.key" class="min-w-0">
                  <dt class="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {{ label(column.label) }}
                  </dt>
                  <dd class="wrap-anywhere text-gray-900 dark:text-white" :data-cell="column.key">
                    <LogCellView :cell="column.cell(entry)" />
                  </dd>
                </div>
              </dl>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

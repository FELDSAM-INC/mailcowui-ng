<script setup lang="ts">
// The entries of a log (FR-031 to FR-033, FR-085; plan decisions 6 and 12): cards below md and a
// table from md, with legacy's columns in legacy's order. On a card, the first line holds the time
// and the entry's class or source, the main text follows, and the other values are its details; in
// the table, legacy's hidden columns are the details. Details open in place (Expand All and
// Collapse All set them all). The time column's header sorts newest or oldest first (`aria-sort`).
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { resolveText, type TextRef } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'
import { ChevronDownIcon } from '@/shared/icons'

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

const ariaSort = computed(() => (props.order === 'asc' ? 'ascending' : 'descending'))
const detailsId = (entry: LogEntry) => `${listId}-${entry.id}`
</script>

<template>
  <ul v-if="!wide" data-log-cards class="flex flex-col gap-3">
    <li
      v-for="entry in entries"
      :key="entry.id"
      :data-entry="entry.id"
      class="min-w-0 rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-gray-800 dark:bg-gray-900"
      :class="stripe(entry)"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-700 dark:text-gray-300">
        <span v-for="column in cardHead" :key="column.key" class="min-w-0" :data-cell="column.key">
          <span class="sr-only">{{ `${label(column.label)}: ` }}</span>
          <LogCellView :cell="column.cell(entry)" />
        </span>
      </div>
      <div
        v-if="cardBody"
        class="mt-2 min-w-0 text-gray-900 dark:text-white"
        :data-cell="cardBody.key"
      >
        <LogCellView :cell="cardBody.cell(entry)" />
      </div>
      <div
        v-if="cardDetails.length > 0 || action"
        class="mt-2 flex flex-wrap items-center justify-between gap-2"
      >
        <button
          v-if="cardDetails.length > 0"
          type="button"
          class="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 font-medium text-accent-text bg-white dark:bg-gray-900 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
          :aria-expanded="expanded.has(entry.id) ? 'true' : 'false'"
          :aria-controls="expanded.has(entry.id) ? detailsId(entry) : undefined"
          @click="emit('toggle', entry.id)"
        >
          <ChevronDownIcon
            class="size-4"
            :class="expanded.has(entry.id) ? 'rotate-180' : ''"
            aria-hidden="true"
          />
          {{ expanded.has(entry.id) ? t('auditLog.details.hide') : t('auditLog.details.show') }}
        </button>
        <LogCellView
          v-if="action"
          :cell="action.cell(entry)"
          @reset="(hash) => emit('reset', hash)"
        />
      </div>
      <dl
        v-if="cardDetails.length > 0 && expanded.has(entry.id)"
        :id="detailsId(entry)"
        data-details
        class="mt-2 grid gap-2 border-t border-gray-200 pt-2 dark:border-gray-800"
      >
        <div v-for="column in cardDetails" :key="column.key" class="min-w-0">
          <dt class="text-xs font-medium text-gray-600 dark:text-gray-400">
            {{ label(column.label) }}
          </dt>
          <dd class="text-gray-900 dark:text-white" :data-cell="column.key">
            <LogCellView :cell="column.cell(entry)" />
          </dd>
        </div>
      </dl>
    </li>
  </ul>

  <div v-else class="table-frame">
    <table data-log-table class="data-table w-full table-fixed text-sm">
      <caption class="sr-only">
        {{
          title
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th
            v-for="column in tableColumns"
            :key="column.key"
            scope="col"
            class="px-2 py-2 text-start"
            :aria-sort="column.key === 'time' ? ariaSort : undefined"
          >
            <button
              v-if="column.key === 'time'"
              type="button"
              data-sort-time
              class="inline-flex min-h-11 min-w-11 items-center gap-1 text-start hover:text-gray-900 dark:hover:text-white"
              @click="emit('sort', order === 'desc' ? 'asc' : 'desc')"
            >
              {{ label(column.label) }}
              <span aria-hidden="true">{{ order === 'asc' ? '▲' : '▼' }}</span>
            </button>
            <template v-else>{{ label(column.label) }}</template>
          </th>
          <th v-if="action" scope="col" class="px-2 py-2 text-end">
            {{ label(action.label) }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="entry in entries" :key="entry.id">
          <tr :data-entry="entry.id" class="align-top text-gray-900 dark:text-white">
            <td
              v-for="(column, index) in tableColumns"
              :key="column.key"
              class="min-w-0 px-2 py-2 wrap-anywhere"
              :class="index === 0 ? stripe(entry) : ''"
              :data-cell="column.key"
            >
              <div v-if="index === 0" class="flex items-start gap-1">
                <button
                  v-if="tableDetails.length > 0"
                  type="button"
                  class="-my-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
                  :aria-label="
                    expanded.has(entry.id) ? t('auditLog.details.hide') : t('auditLog.details.show')
                  "
                  :aria-expanded="expanded.has(entry.id) ? 'true' : 'false'"
                  :aria-controls="expanded.has(entry.id) ? detailsId(entry) : undefined"
                  @click="emit('toggle', entry.id)"
                >
                  <ChevronDownIcon
                    class="size-4"
                    :class="expanded.has(entry.id) ? 'rotate-180' : ''"
                  />
                </button>
                <span class="min-w-0"><LogCellView :cell="column.cell(entry)" /></span>
              </div>
              <LogCellView v-else :cell="column.cell(entry)" />
            </td>
            <td v-if="action" class="px-2 py-2 text-end">
              <LogCellView :cell="action.cell(entry)" @reset="(hash) => emit('reset', hash)" />
            </td>
          </tr>
          <tr v-if="tableDetails.length > 0 && expanded.has(entry.id)" :id="detailsId(entry)">
            <td :colspan="tableColumns.length + (action ? 1 : 0)" class="px-2 py-2">
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

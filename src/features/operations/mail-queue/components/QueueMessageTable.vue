<script setup lang="ts">
// The queue as a table from md up (FR-051), with legacy's columns (`js/site/queue.js`): QID, Queue,
// arrival time, message size, sender, the recipients as "address (reason)" lines, and the action
// "Show message". The headers of the sortable columns sort the list (`aria-sort`). Slots:
// `select-all`, `select` (selection mode).
import type { RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'

import type { MailQueueMessage } from '@/api'
import { legacy, lt, resolveText, type TextRef } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PlainText from '@/shared/components/PlainText.vue'
import RelativeTime from '@/shared/components/RelativeTime.vue'
import RowControls from '@/shared/components/RowControls.vue'
import RowAction from '@/shared/components/RowAction.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import type { MailQueueSort } from '../list-state'
import { recipientText } from '../presentation'

const props = withDefaults(
  defineProps<{
    messages: readonly MailQueueMessage[]
    sort: MailQueueSort
    order: SortOrder
    selectable?: boolean
    show: (message: MailQueueMessage) => RouteLocationRaw
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: MailQueueSort, order: SortOrder] }>()
const { t } = useI18n()
const fmt = useFormat()

interface Column {
  key: string
  label: TextRef
  sort?: MailQueueSort
}

const COLUMNS: Column[] = [
  { key: 'id', label: 'operations.queue.qid', sort: 'id' },
  { key: 'queue', label: 'operations.queue.queue', sort: 'queue' },
  { key: 'arrivalTime', label: legacy('admin.arrival_time'), sort: 'arrivalTime' },
  { key: 'size', label: legacy('admin.message_size'), sort: 'size' },
  { key: 'sender', label: legacy('admin.sender'), sort: 'sender' },
  { key: 'recipients', label: legacy('admin.recipients') },
]

const label = (ref: TextRef) => resolveText(ref, t)

function ariaSort(key: MailQueueSort | undefined) {
  if (!key) return undefined
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(key: MailQueueSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}
</script>

<template>
  <div class="table-frame">
    <table class="data-table w-full table-auto text-sm">
      <caption class="sr-only">
        {{
          lt('queue.queue_manager')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-2 py-2"><slot name="select-all" /></th>
          <th
            v-for="column in COLUMNS"
            :key="column.key"
            scope="col"
            class="px-2 py-2 text-start"
            :aria-sort="ariaSort(column.sort)"
          >
            <button
              v-if="column.sort"
              type="button"
              class="inline-flex min-h-11 min-w-11 items-center gap-1 text-start hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.sort)"
            >
              {{ label(column.label) }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
            <template v-else>{{ label(column.label) }}</template>
          </th>
          <th scope="col" class="table-controls-cell px-2 py-2 text-end">
            {{ lt('admin.action') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr
          v-for="message in messages"
          :key="message.id"
          :data-entry="message.id"
          class="align-top text-gray-900 dark:text-white"
        >
          <td v-if="selectable" class="px-2 py-2"><slot name="select" :message="message" /></td>
          <th
            :id="`queue-row-${message.id}`"
            scope="row"
            class="px-2 py-3 text-start font-mono font-medium"
          >
            {{ message.id }}
          </th>
          <td class="px-2 py-3">{{ message.queue }}</td>
          <td class="px-2 py-3"><RelativeTime :value="message.arrivalTime" /></td>
          <td class="px-2 py-3 whitespace-nowrap">{{ fmt.bytes(message.sizeBytes) }}</td>
          <td class="max-w-48 px-2 py-3"><PlainText :value="message.sender" /></td>
          <td class="max-w-80 px-2 py-3">
            <ul class="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
              <li v-for="(recipient, index) in message.recipients" :key="index" class="py-0.5">
                <PlainText :value="recipientText(recipient)" />
              </li>
            </ul>
          </td>
          <td class="table-controls-cell px-2 py-1 text-end">
            <RowControls>
              <RowAction
                :menu="false"
                :label="lt('queue.show_message')"
                :to="show(message)"
                :data-show-message="message.id"
                :aria-describedby="`queue-row-${message.id}`"
              />
            </RowControls>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

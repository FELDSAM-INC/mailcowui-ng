<script setup lang="ts">
// The mailbox list as a table from md up (FR-008, FR-010): legacy's columns in its order with its
// header keys, the sortable ones as header buttons with `aria-sort`, and legacy's "Action" column
// last. The table scrolls inside its frame when the chosen columns are wider than the page.
// Slots: `select-all` and `select` (selection mode, US6) and `actions`.
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { ColumnId, ColumnSpec } from '../../columns'
import type { MailboxSort } from '../../labels'
import { readableAddress, type Mailbox } from '../../types'
import MailboxCell from './MailboxCell.vue'

const props = withDefaults(
  defineProps<{
    mailboxes: readonly Mailbox[]
    columns: readonly ColumnSpec[]
    sort: MailboxSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: MailboxSort, order: SortOrder] }>()
const compact = useMediaQuery('(min-width: 1024px) and (hover: hover) and (pointer: fine)')
const desktopWidths: Partial<Record<ColumnId, string>> = {
  address: 'min-w-48',
  quota: 'min-w-32',
  lastMailLogin: 'min-w-56',
  passwordChangedAt: 'min-w-40',
  inUse: 'min-w-20',
  messages: 'min-w-16',
  status: 'min-w-20',
  displayName: 'min-w-40',
  domain: 'min-w-48',
  createdAt: 'min-w-40',
  modifiedAt: 'min-w-40',
}
const columnWidth = (id: ColumnId) => (compact.value ? desktopWidths[id] : undefined)
const singleLine = (id: ColumnId) =>
  compact.value && ['quota', 'passwordChangedAt', 'createdAt', 'modifiedAt'].includes(id)

function ariaSort(key: MailboxSort | undefined) {
  if (!key) return undefined
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(key: MailboxSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const header = (column: ColumnSpec) => (column.label ? lt(column.label) : (column.text ?? ''))
</script>

<template>
  <div class="table-frame">
    <table class="data-table w-full table-auto text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.mailboxes')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-3 py-2"><slot name="select-all" /></th>
          <th
            v-for="column in columns"
            :key="column.id"
            scope="col"
            :data-column="column.id"
            class="px-3 py-2 text-start align-bottom"
            :class="columnWidth(column.id)"
            :aria-sort="ariaSort(column.sort)"
          >
            <button
              v-if="column.sort"
              type="button"
              class="inline-flex min-h-11 min-w-11 items-center gap-1 text-start hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.sort)"
            >
              {{ header(column) }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
            <template v-else>{{ header(column) }}</template>
          </th>
          <th scope="col" class="px-3 py-2 text-end align-bottom">
            {{ lt('mailbox.action') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr
          v-for="mailbox in mailboxes"
          :key="mailbox.address"
          :data-entry="mailbox.address"
          class="align-top"
        >
          <td v-if="selectable" class="px-3 py-3"><slot name="select" :mailbox="mailbox" /></td>
          <td
            v-for="column in columns"
            :key="column.id"
            :data-cell="column.id"
            class="px-3 py-3 text-gray-900 dark:text-white"
            :class="[
              columnWidth(column.id),
              column.id === 'address' || column.id === 'displayName' ? 'max-w-72' : '',
              singleLine(column.id) ? 'whitespace-nowrap' : '',
            ]"
          >
            <RouterLink
              v-if="column.id === 'address'"
              :to="{ name: 'mailbox-detail', params: { address: mailbox.address } }"
              class="inline-flex min-h-11 max-w-full items-center font-semibold wrap-anywhere text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
            >
              {{ readableAddress(mailbox) }}
            </RouterLink>
            <MailboxCell v-else :mailbox="mailbox" :column="column.id" :compact-logins="compact" />
          </td>
          <td class="px-3 py-3">
            <slot name="actions" :mailbox="mailbox" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

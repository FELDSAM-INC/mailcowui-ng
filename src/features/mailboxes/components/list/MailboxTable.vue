<script setup lang="ts">
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

import MailboxStatusBadge from '../display/MailboxStatusBadge.vue'

// The mailbox list as a table from md up (FR-008, FR-010): legacy's columns in its order with its
// header keys, the sortable ones as header buttons with `aria-sort`, and legacy's "Action" column
// last. The table scrolls inside its frame when the chosen columns are wider than the page.
// Slots: `select-all` and `select` (selection mode, US6) and `actions`.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import { COLUMNS, type ColumnId, type ColumnSpec } from '../../columns'
import type { MailboxSort } from '../../labels'
import { readableAddress, type Mailbox } from '../../types'
import MailboxCell from './MailboxCell.vue'

const props = withDefaults(
  defineProps<{
    hidden?: boolean
    mailboxes: readonly Mailbox[]
    columns: readonly ColumnSpec[]
    sort: MailboxSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: MailboxSort, order: SortOrder] }>()
const { t } = useI18n()
const expanded = ref(new Set<string>())
const compact = useMediaQuery('(min-width: 1024px) and (hover: hover) and (pointer: fine)')
const details = computed(() =>
  COLUMNS.filter(
    (column) =>
      (column.id !== 'status' && !tableView.visible(column.id)) ||
      (compact.value && column.id === 'lastMailLogin'),
  ),
)
const detailsId = (address: string) => `mailbox-details-${encodeURIComponent(address)}`
function toggle(address: string) {
  const next = new Set(expanded.value)
  if (next.has(address)) next.delete(address)
  else next.add(address)
  expanded.value = next
}
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

function sortBy(key: MailboxSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const header = (column: ColumnSpec) => (column.label ? lt(column.label) : (column.text ?? ''))

const tableView = useDataColumns(
  () =>
    props.columns.map((column) => ({
      id: column.id,
      label: header(column),
      sort: column.sort,
      defaultVisible: column.default,
    })),
  () => ({
    key: props.sort,
    order: props.order,
    change: (key) => sortBy(key as Parameters<typeof sortBy>[0]),
  }),
)
</script>

<template>
  <div v-if="!hidden" class="table-frame">
    <table class="data-table w-full table-auto text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.mailboxes')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-3 py-2"><slot name="select-all" /></th>
          <DataTableHeader
            v-for="column in columns"
            :key="column.id"
            :column="String(column.id)"
            :data-column="column.id"
            class="px-3 py-2 text-start align-bottom"
            :class="columnWidth(column.id)"
          />
          <th scope="col" class="table-controls-cell px-3 py-2 text-end align-bottom">
            {{ lt('mailbox.action') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="mailbox in mailboxes" :key="mailbox.address">
          <tr :data-entry="mailbox.address" class="align-top">
            <td v-if="selectable" class="px-3 py-3"><slot name="select" :mailbox="mailbox" /></td>
            <td
              v-for="column in columns"
              v-show="tableView.visible(String(column.id))"
              :key="column.id"
              :data-column="String(column.id)"
              :data-cell="column.id"
              class="px-3 py-3 text-gray-900 dark:text-white"
              :class="[
                columnWidth(column.id),
                column.id === 'address' || column.id === 'displayName' ? 'max-w-72' : '',
                singleLine(column.id) ? 'whitespace-nowrap' : '',
              ]"
            >
              <div
                v-if="column.id === 'address'"
                class="table-record flex flex-col items-start gap-1.5"
              >
                <RouterLink
                  :to="{ name: 'mailbox-detail', params: { address: mailbox.address } }"
                  class="inline-flex min-h-11 max-w-full items-center font-semibold wrap-anywhere text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
                >
                  {{ readableAddress(mailbox) }} </RouterLink
                ><MailboxStatusBadge :status="mailbox.status" />
              </div>
              <MailboxCell
                v-else
                :mailbox="mailbox"
                :column="column.id"
                :compact-logins="compact"
              />
            </td>
            <td class="table-controls-cell px-3 py-3">
              <RowControls
                :expanded="details.length ? expanded.has(mailbox.address) : undefined"
                :controls="detailsId(mailbox.address)"
                :label="t('domains.list.detailsOf', { name: readableAddress(mailbox) })"
                @toggle="toggle(mailbox.address)"
              >
                <slot name="actions" :mailbox="mailbox" />
              </RowControls>
            </td>
          </tr>
          <tr
            v-if="details.length && expanded.has(mailbox.address)"
            :id="detailsId(mailbox.address)"
          >
            <td
              :colspan="
                columns.length +
                1 +
                (selectable ? 1 : 0) -
                tableView.columns.value.length +
                tableView.visibleCount.value
              "
              class="bg-gray-50 px-3 py-3 dark:bg-gray-950"
            >
              <dl
                :data-entry-details="mailbox.address"
                class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3"
              >
                <div v-for="column in details" :key="column.id">
                  <dt class="mb-1 text-gray-600 dark:text-gray-400">{{ header(column) }}</dt>
                  <dd class="min-w-0 text-gray-900 dark:text-white">
                    <MailboxCell :mailbox="mailbox" :column="column.id" />
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

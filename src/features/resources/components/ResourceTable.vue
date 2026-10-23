<script setup lang="ts">
import DataIdentity from '@/shared/components/DataIdentity.vue'

import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

import ActiveBadge from '@/shared/components/ActiveBadge.vue'

// The resource list as a table from md up (FR-042, FR-043), the classic table's columns
// (`draw_resource_table()`): description, address, kind, domain, multiple bookings, active and the
// action, with `aria-sort` on the contract's sort keys. Slots: `select-all`, `select`, `actions`.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Resource } from '@/api'

import { legacy, lt, resolveText, type TextRef } from '@/i18n'
import MessageText from '@/shared/components/MessageText.vue'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import type { ResourceSort } from '../list-state'
import BookingRuleBadge from './BookingRuleBadge.vue'

const props = withDefaults(
  defineProps<{
    hidden?: boolean
    resources: readonly Resource[]
    sort: ResourceSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: ResourceSort, order: SortOrder] }>()
const { t } = useI18n()

const COLUMNS: { key: string; label: TextRef; sort: ResourceSort }[] = [
  { key: 'description', label: legacy('mailbox.description'), sort: 'description' },
  { key: 'address', label: legacy('mailbox.alias'), sort: 'address' },
  { key: 'kind', label: legacy('mailbox.kind'), sort: 'kind' },
  { key: 'domain', label: legacy('mailbox.domain'), sort: 'domain' },
  { key: 'bookingRule', label: legacy('mailbox.multiple_bookings'), sort: 'bookingRule' },
]

function sortBy(key: ResourceSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const tableView = useDataColumns(
  () =>
    COLUMNS.map((column) => ({
      id: column.key,
      label: resolveText(column.label, t),
      sort: column.sort,
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
    <table class="data-table w-full table-fixed text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.resources')
        }}
      </caption>
      <thead class="border-b border-gray-200 dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-14 px-2 py-2"><slot name="select-all" /></th>
          <DataTableHeader
            v-for="column in COLUMNS"
            :key="column.key"
            :column="String(column.key)"
            class="px-2 py-2 text-start align-bottom"
          />
          <th scope="col" class="table-controls-cell px-2 py-2 text-end">
            <span class="sr-only">{{ lt('mailbox.action') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr
          v-for="item in resources"
          :key="item.address"
          :data-entry="item.address"
          class="align-top"
        >
          <td v-if="selectable" class="px-2 py-3"><slot name="select" :resource="item" /></td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[0]!.id))"
            :data-column="String(tableView.columns.value[0]!.id)"
            class="px-2 py-3"
          >
            <DataIdentity
              ><RouterLink
                :to="{ name: 'resource-detail', params: { resourceAddress: item.address } }"
                class="inline-flex min-h-11 max-w-full items-center font-medium break-words text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
              >
                {{ item.description }} </RouterLink
              ><template #badges><ActiveBadge :active="item.active" /></template
            ></DataIdentity>
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[1]!.id))"
            :data-column="String(tableView.columns.value[1]!.id)"
            class="px-2 py-3 break-all text-gray-900 dark:text-white"
          >
            {{ item.addressUnicode }}
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[2]!.id))"
            :data-column="String(tableView.columns.value[2]!.id)"
            class="px-2 py-3 text-gray-900 dark:text-white"
          >
            <MessageText :k="`enums.resourceKind.${item.kind}`" />
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[3]!.id))"
            :data-column="String(tableView.columns.value[3]!.id)"
            class="px-2 py-3 break-all text-gray-900 dark:text-white"
          >
            {{ item.domainUnicode }}
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[4]!.id))"
            :data-column="String(tableView.columns.value[4]!.id)"
            class="px-2 py-3"
          >
            <BookingRuleBadge :resource="item" />
          </td>

          <td class="table-controls-cell px-2 py-3">
            <RowControls><slot name="actions" :resource="item" /></RowControls>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

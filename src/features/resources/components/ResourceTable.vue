<script setup lang="ts">
// The resource list as a table from md up (FR-042, FR-043), the classic table's columns
// (`draw_resource_table()`): description, address, kind, domain, multiple bookings, active and the
// action, with `aria-sort` on the contract's sort keys. Slots: `select-all`, `select`, `actions`.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Resource } from '@/api'
import { YesNoMark } from '@/features/aliases-common'
import { legacy, lt, resolveText, type TextRef } from '@/i18n'
import MessageText from '@/shared/components/MessageText.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import type { ResourceSort } from '../list-state'
import BookingRuleBadge from './BookingRuleBadge.vue'

const props = withDefaults(
  defineProps<{
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
  { key: 'active', label: legacy('mailbox.active'), sort: 'active' },
]

function ariaSort(key: ResourceSort) {
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(key: ResourceSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
    <table class="w-full table-fixed text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.resources')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400">
        <tr>
          <th v-if="selectable" scope="col" class="w-14 px-2 py-2"><slot name="select-all" /></th>
          <th
            v-for="column in COLUMNS"
            :key="column.key"
            scope="col"
            class="px-2 py-2 text-start align-bottom font-medium"
            :aria-sort="ariaSort(column.sort)"
          >
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start font-medium break-words hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.sort)"
            >
              {{ resolveText(column.label, t) }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
          </th>
          <th scope="col" class="w-16 px-2 py-2 text-end font-medium">
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
          <td class="px-2 py-3">
            <RouterLink
              :to="{ name: 'resource-detail', params: { resourceAddress: item.address } }"
              class="inline-flex min-h-11 max-w-full items-center font-medium break-words text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
            >
              {{ item.description }}
            </RouterLink>
          </td>
          <td class="px-2 py-3 break-all text-gray-900 dark:text-white">
            {{ item.addressUnicode }}
          </td>
          <td class="px-2 py-3 text-gray-900 dark:text-white">
            <MessageText :k="`enums.resourceKind.${item.kind}`" />
          </td>
          <td class="px-2 py-3 break-all text-gray-900 dark:text-white">
            {{ item.domainUnicode }}
          </td>
          <td class="px-2 py-3"><BookingRuleBadge :resource="item" /></td>
          <td class="px-2 py-3" data-field="active"><YesNoMark :value="item.active" /></td>
          <td class="px-2 py-3 text-end"><slot name="actions" :resource="item" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

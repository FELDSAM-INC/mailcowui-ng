<script setup lang="ts">
import DataRow from '@/shared/components/DataRow.vue'

import DataIdentity from '@/shared/components/DataIdentity.vue'

import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

import ActiveBadge from '@/shared/components/ActiveBadge.vue'

// MTA-STS policies as a table from md up (FR-055): sortable headers with `aria-sort` for the
// domain, mode, max age and identifier; the MX servers and the active state.
import { useI18n } from 'vue-i18n'

import type { MtaStsPolicy } from '@/api'
import { lt, text } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import RowControls from '@/shared/components/RowControls.vue'
import RowAction from '@/shared/components/RowAction.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import type { MtaStsSort } from '../mta-sts/list-state'

const props = defineProps<{
  hidden?: boolean
  policies: readonly MtaStsPolicy[]
  sort: MtaStsSort
  order: SortOrder
}>()
const emit = defineEmits<{ sort: [sort: MtaStsSort, order: SortOrder] }>()
const { locale } = useI18n()

type Column = MtaStsSort | 'mxHosts' | 'active'
const COLUMNS: { key: Column; sortable: boolean }[] = [
  { key: 'domain', sortable: true },

  { key: 'mode', sortable: true },
  { key: 'mxHosts', sortable: false },
  { key: 'maxAge', sortable: true },
  { key: 'policyId', sortable: true },
]

function header(key: Column): string {
  if (key === 'mxHosts') return lt('edit.mta_sts_mx')
  if (key === 'active') return lt('edit.active')
  return text(`dns.mtaSts.sort.${key}`)
}

function onSort(key: MtaStsSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const tableView = useDataColumns(
  () =>
    COLUMNS.map((column) => ({
      id: column.key,
      label: header(column.key),
      sort: column.sortable ? column.key : undefined,
    })),
  () => ({ key: props.sort, order: props.order, change: (key) => onSort(key as MtaStsSort) }),
)
</script>

<template>
  <div v-if="!hidden" class="table-frame">
    <table class="data-table w-full table-fixed text-start text-sm">
      <thead>
        <tr>
          <DataTableHeader
            v-for="column in COLUMNS"
            :key="column.key"
            :column="String(column.key)"
            class="px-3 py-2 text-start"
            :class="column.key === 'domain' ? 'w-1/4' : ''"
          />
          <th scope="col" class="table-controls-cell px-3 py-2 text-end">
            {{ lt('mailbox.action') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <DataRow
          v-for="policy in policies"
          :key="policy.domain"
          :to="{ name: 'domain-detail', params: { domain: policy.domain }, hash: '#mta-sts' }"
          :label="policy.domain"
          :data-entry="policy.domain"
        >
          <td
            v-show="tableView.visible(String(tableView.columns.value[0]!.id))"
            :data-column="String(tableView.columns.value[0]!.id)"
            class="px-3 py-2 font-medium text-gray-900 dark:text-white"
          >
            <DataIdentity
              ><span class="font-medium wrap-anywhere"
                ><DomainNameText :name="policy.domain" :unicode-name="policy.displayDomain" /></span
              ><template #badges><ActiveBadge :active="policy.active" /></template
            ></DataIdentity>
          </td>

          <td
            v-show="tableView.visible(String(tableView.columns.value[1]!.id))"
            :data-column="String(tableView.columns.value[1]!.id)"
            class="px-3 py-2 font-mono text-gray-900 dark:text-white"
          >
            {{ policy.mode }}
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[2]!.id))"
            :data-column="String(tableView.columns.value[2]!.id)"
            class="px-3 py-2 font-mono break-all text-gray-900 dark:text-white"
          >
            {{ policy.mxHosts.join(', ') }}
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[3]!.id))"
            :data-column="String(tableView.columns.value[3]!.id)"
            class="px-3 py-2 text-gray-900 dark:text-white"
          >
            {{ formatNumber(policy.maxAge, locale as AppLocale) }}
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[4]!.id))"
            :data-column="String(tableView.columns.value[4]!.id)"
            class="px-3 py-2 font-mono break-all text-gray-900 dark:text-white"
          >
            {{ policy.policyId }}
          </td>
          <td class="table-controls-cell px-3 py-2">
            <RowControls>
              <RowAction
                :menu="false"
                :label="lt('mailbox.edit')"
                :to="{ name: 'domain-detail', params: { domain: policy.domain }, hash: '#mta-sts' }"
                :aria-label="`${lt('mailbox.edit')}: ${policy.displayDomain}`"
              />
            </RowControls>
          </td>
        </DataRow>
      </tbody>
    </table>
  </div>
</template>

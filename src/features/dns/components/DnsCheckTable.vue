<script setup lang="ts">
import { useDataColumns } from '@/shared/composables/useDataList'
import { dnsCheckColumns } from '../diagnostics/check-columns'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

// Diagnostics checks as a table from md up (FR-068), with the classic interface's columns: Name
// (the purpose and the record name), Type, Correct Data (the expected value or guidance) and
// Current State (status, values found, reason and notes), in the API's order.
import type { DnsCheck } from '@/api'
import { text } from '@/i18n'

import { checkLabel } from '../diagnostics/check-labels'
import DnsCheckExpected from './DnsCheckExpected.vue'
import DnsCheckName from './DnsCheckName.vue'
import DnsCheckState from './DnsCheckState.vue'

defineProps<{ checks: readonly DnsCheck[]; caption: string }>()

function label(check: DnsCheck): string {
  const view = checkLabel(check)
  return text(view.key, view.params)
}

const tableView = useDataColumns(dnsCheckColumns)
</script>

<template>
  <div class="table-frame">
    <table class="data-table w-full table-fixed text-start text-sm">
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <DataTableHeader column="name" />
          <DataTableHeader column="type" />
          <DataTableHeader column="data" />
          <DataTableHeader column="status" />
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr
          v-for="check in checks"
          :key="check.id"
          data-check
          :data-check-id="check.id"
          class="align-top"
        >
          <th
            v-show="tableView.visible('name')"
            :data-column="'name'"
            scope="row"
            class="px-3 py-2 text-start font-normal"
          >
            <DnsCheckName :label="label(check)" :record-name="check.recordName" />
          </th>
          <td
            v-show="tableView.visible('type')"
            :data-column="'type'"
            class="px-3 py-2 font-mono text-gray-900 dark:text-white"
          >
            {{ check.recordType }}
          </td>
          <td v-show="tableView.visible('data')" :data-column="'data'" class="px-3 py-2">
            <DnsCheckExpected :check="check" :label="label(check)" compact />
          </td>
          <td v-show="tableView.visible('status')" :data-column="'status'" class="px-3 py-2">
            <DnsCheckState :check="check" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

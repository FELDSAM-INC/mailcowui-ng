<script setup lang="ts">
// Diagnostics checks as a table from md up (FR-068), with the classic interface's columns: Name
// (the purpose and the record name), Type, Correct Data (the expected value or guidance) and
// Current State (status, values found, reason and notes), in the API's order.
import type { DnsCheck } from '@/api'
import { lt, text } from '@/i18n'

import { checkLabel } from '../diagnostics/check-labels'
import DnsCheckExpected from './DnsCheckExpected.vue'
import DnsCheckName from './DnsCheckName.vue'
import DnsCheckState from './DnsCheckState.vue'

defineProps<{ checks: readonly DnsCheck[]; caption: string }>()

function label(check: DnsCheck): string {
  const view = checkLabel(check)
  return text(view.key, view.params)
}
</script>

<template>
  <div class="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
    <table class="w-full table-fixed text-start text-sm">
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead class="bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <tr>
          <th scope="col" class="w-1/4 px-3 py-2 text-start font-medium">
            {{ lt('diagnostics.dns_records_name') }}
          </th>
          <th scope="col" class="w-20 px-3 py-2 text-start font-medium">
            {{ lt('diagnostics.dns_records_type') }}
          </th>
          <th scope="col" class="px-3 py-2 text-start font-medium">
            {{ lt('diagnostics.dns_records_data') }}
          </th>
          <th scope="col" class="px-3 py-2 text-start font-medium">
            {{ lt('diagnostics.dns_records_status') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
        <tr
          v-for="check in checks"
          :key="check.id"
          data-check
          :data-check-id="check.id"
          class="align-top"
        >
          <th scope="row" class="px-3 py-2 text-start font-normal">
            <DnsCheckName :label="label(check)" :record-name="check.recordName" />
          </th>
          <td class="px-3 py-2 font-mono text-gray-900 dark:text-white">{{ check.recordType }}</td>
          <td class="px-3 py-2">
            <DnsCheckExpected :check="check" :label="label(check)" compact />
          </td>
          <td class="px-3 py-2"><DnsCheckState :check="check" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

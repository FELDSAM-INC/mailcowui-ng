<script setup lang="ts">
// MTA-STS policies as a table from md up (FR-055): sortable headers with `aria-sort` for the
// domain, mode, max age and identifier; the MX servers and the active state.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { MtaStsPolicy } from '@/api'
import { lt, text } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { ChevronDownIcon } from '@/shared/icons'

import type { MtaStsSort } from '../mta-sts/list-state'
import MtaStsActiveBadge from './MtaStsActiveBadge.vue'

const props = defineProps<{
  policies: readonly MtaStsPolicy[]
  sort: MtaStsSort
  order: SortOrder
}>()
const emit = defineEmits<{ sort: [sort: MtaStsSort, order: SortOrder] }>()
const { locale } = useI18n()

type Column = MtaStsSort | 'mxHosts' | 'active'
const COLUMNS: { key: Column; sortable: boolean }[] = [
  { key: 'domain', sortable: true },
  { key: 'active', sortable: false },
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

function ariaSort(key: Column) {
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function onSort(key: MtaStsSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}
</script>

<template>
  <div class="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
    <table class="w-full table-fixed text-start text-sm">
      <thead class="bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <tr>
          <th
            v-for="column in COLUMNS"
            :key="column.key"
            scope="col"
            class="px-3 py-2 text-start font-medium"
            :class="column.key === 'domain' ? 'w-1/4' : ''"
            :aria-sort="column.sortable ? ariaSort(column.key) : undefined"
          >
            <button
              v-if="column.sortable"
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start"
              @click="onSort(column.key as MtaStsSort)"
            >
              {{ header(column.key) }}
              <ChevronDownIcon
                v-if="column.key === sort"
                class="size-4"
                :class="order === 'asc' ? 'rotate-180' : ''"
              />
            </button>
            <template v-else>{{ header(column.key) }}</template>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
        <tr v-for="policy in policies" :key="policy.domain" :data-entry="policy.domain">
          <td class="px-3 py-2 font-medium text-gray-900 dark:text-white">
            <RouterLink
              :to="{ name: 'domain-detail', params: { domain: policy.domain }, hash: '#mta-sts' }"
              class="inline-flex min-h-11 items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <DomainNameText :name="policy.domain" :unicode-name="policy.displayDomain" />
            </RouterLink>
          </td>
          <td class="px-3 py-2"><MtaStsActiveBadge :active="policy.active" /></td>
          <td class="px-3 py-2 font-mono text-gray-900 dark:text-white">{{ policy.mode }}</td>
          <td class="px-3 py-2 font-mono break-all text-gray-900 dark:text-white">
            {{ policy.mxHosts.join(', ') }}
          </td>
          <td class="px-3 py-2 text-gray-900 dark:text-white">
            {{ formatNumber(policy.maxAge, locale as AppLocale) }}
          </td>
          <td class="px-3 py-2 font-mono break-all text-gray-900 dark:text-white">
            {{ policy.policyId }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

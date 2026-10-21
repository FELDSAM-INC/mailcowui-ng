<script setup lang="ts">
// The domain alias list as a table from md up (FR-033, FR-034), the classic table's columns
// (`draw_aliasdomain_table()`): alias domain, target domain, active and the action, with
// `aria-sort` on the contract's sort keys. Slots: `select-all`, `select` (US6) and `actions`.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { AliasDomain } from '@/api'
import { YesNoMark } from '@/features/aliases-common'
import { legacy, lt, resolveText, type TextRef } from '@/i18n'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import type { AliasDomainSort } from '../list-state'
import TargetDomainText from './TargetDomainText.vue'

const props = withDefaults(
  defineProps<{
    aliasDomains: readonly AliasDomain[]
    sort: AliasDomainSort
    order: SortOrder
    linkDomains: boolean
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: AliasDomainSort, order: SortOrder] }>()
const { t } = useI18n()

const COLUMNS: { key: string; label: TextRef; sort: AliasDomainSort }[] = [
  { key: 'name', label: legacy('mailbox.alias'), sort: 'name' },
  { key: 'targetDomain', label: legacy('mailbox.target_domain'), sort: 'targetDomain' },
  { key: 'active', label: legacy('mailbox.active'), sort: 'active' },
]

function ariaSort(key: AliasDomainSort) {
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(key: AliasDomainSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}
</script>

<template>
  <div class="table-frame">
    <table class="data-table w-full table-fixed text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.domain_aliases')
        }}
      </caption>
      <thead class="border-b border-gray-200 dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-14 px-2 py-2"><slot name="select-all" /></th>
          <th
            v-for="column in COLUMNS"
            :key="column.key"
            scope="col"
            class="px-2 py-2 text-start align-bottom"
            :aria-sort="ariaSort(column.sort)"
          >
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start break-words hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.sort)"
            >
              {{ resolveText(column.label, t) }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
          </th>
          <th scope="col" class="table-controls-cell px-2 py-2 text-end">
            <span class="sr-only">{{ lt('mailbox.action') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr v-for="item in aliasDomains" :key="item.name" :data-entry="item.name" class="align-top">
          <td v-if="selectable" class="px-2 py-3"><slot name="select" :alias-domain="item" /></td>
          <td class="px-2 py-3">
            <RouterLink
              :to="{ name: 'alias-domain-detail', params: { aliasDomain: item.name } }"
              class="inline-flex min-h-11 max-w-full items-center font-medium text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
            >
              <DomainNameText :name="item.name" :unicode-name="item.nameUnicode" />
            </RouterLink>
          </td>
          <td class="px-2 py-3 text-gray-900 dark:text-white">
            <TargetDomainText :alias-domain="item" :link-domains="linkDomains" />
          </td>
          <td class="px-2 py-3" data-field="active"><YesNoMark :value="item.active" /></td>
          <td class="table-controls-cell px-2 py-3">
            <RowControls><slot name="actions" :alias-domain="item" /></RowControls>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

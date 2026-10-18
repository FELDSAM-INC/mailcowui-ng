<script setup lang="ts">
// The alias list as a table from md up (FR-007, FR-012, FR-014): the classic table's columns
// (`draw_alias_table()`) — ID, alias, goto address, domain, SOGo visible (only with the groupware),
// the comments, internal, active and the action — with `aria-sort` on the contract's sort keys.
// ID and the comments are columns from xl up and lines under the address below it, so that nothing
// needs horizontal scrolling. Slots: `select-all`, `select` (US6) and `actions` (US3).
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Alias } from '@/api'
import { lt, legacy, resolveText, type TextRef } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import type { AliasSort } from '../list-state'
import AddressText from './AddressText.vue'
import AliasBadges from './AliasBadges.vue'
import AliasDomainText from './AliasDomainText.vue'
import DestinationSummary from './DestinationSummary.vue'
import YesNoMark from './YesNoMark.vue'

const props = withDefaults(
  defineProps<{
    aliases: readonly Alias[]
    sort: AliasSort
    order: SortOrder
    groupwareEnabled: boolean | undefined
    canSeeOrphaned: boolean
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: AliasSort, order: SortOrder] }>()
const { t } = useI18n()

interface Column {
  key: string
  label: TextRef
  sort?: AliasSort
  className?: string
}

const COLUMNS: Column[] = [
  { key: 'id', label: 'lists.id', sort: 'id', className: 'hidden xl:table-cell' },
  { key: 'address', label: legacy('mailbox.alias'), sort: 'address' },
  { key: 'destinations', label: legacy('mailbox.target_address') },
  { key: 'domain', label: legacy('mailbox.domain'), sort: 'domain' },
  { key: 'groupwareVisible', label: legacy('mailbox.sogo_visible'), sort: 'groupwareVisible' },
  {
    key: 'publicComment',
    label: legacy('mailbox.public_comment'),
    className: 'hidden xl:table-cell',
  },
  {
    key: 'privateComment',
    label: legacy('mailbox.private_comment'),
    className: 'hidden xl:table-cell',
  },
  { key: 'internal', label: legacy('mailbox.internal'), sort: 'internal' },
  { key: 'active', label: legacy('mailbox.active'), sort: 'active' },
]

const columns = () =>
  COLUMNS.filter((column) => column.key !== 'groupwareVisible' || props.groupwareEnabled)

function ariaSort(key: AliasSort | undefined) {
  if (!key) return undefined
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(key: AliasSort) {
  const order =
    key === props.sort ? (props.order === 'asc' ? 'desc' : 'asc') : key === 'id' ? 'desc' : 'asc'
  emit('sort', key, order)
}

const comment = (value: string) => value || '-'
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
    <table class="w-full table-fixed text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.aliases')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400">
        <tr>
          <th v-if="selectable" scope="col" class="w-14 px-2 py-2"><slot name="select-all" /></th>
          <th
            v-for="column in columns()"
            :key="column.key"
            scope="col"
            class="px-2 py-2 text-start align-bottom font-medium"
            :class="column.className"
            :aria-sort="ariaSort(column.sort)"
          >
            <button
              v-if="column.sort"
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start font-medium break-words hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.sort)"
            >
              {{ resolveText(column.label, t) }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
            <span v-else class="break-words">{{ resolveText(column.label, t) }}</span>
          </th>
          <th scope="col" class="w-16 px-2 py-2 text-end font-medium">
            <span class="sr-only">{{ lt('mailbox.action') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr v-for="alias in aliases" :key="alias.id" :data-entry="alias.id" class="align-top">
          <td v-if="selectable" class="px-2 py-3"><slot name="select" :alias="alias" /></td>
          <td class="hidden px-2 py-3 text-gray-700 xl:table-cell dark:text-gray-300">
            {{ alias.id }}
          </td>
          <td class="px-2 py-3">
            <div class="flex min-w-0 flex-col gap-1.5">
              <RouterLink
                :to="{ name: 'alias-detail', params: { aliasId: alias.id } }"
                class="inline-flex min-h-11 max-w-full items-center font-medium text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
              >
                <AddressText :address="alias.address" :address-unicode="alias.addressUnicode" />
              </RouterLink>
              <AliasBadges :alias="alias" :can-see-orphaned="canSeeOrphaned" />
              <dl class="flex flex-col gap-0.5 text-xs text-gray-600 xl:hidden dark:text-gray-400">
                <div class="flex gap-1">
                  <dt>{{ t('lists.id') }}:</dt>
                  <dd>{{ alias.id }}</dd>
                </div>
                <div v-if="alias.publicComment" class="flex min-w-0 gap-1">
                  <dt class="shrink-0">{{ lt('mailbox.public_comment') }}:</dt>
                  <dd class="min-w-0 break-words">{{ alias.publicComment }}</dd>
                </div>
                <div v-if="alias.privateComment" class="flex min-w-0 gap-1">
                  <dt class="shrink-0">{{ lt('mailbox.private_comment') }}:</dt>
                  <dd class="min-w-0 break-words">{{ alias.privateComment }}</dd>
                </div>
              </dl>
            </div>
          </td>
          <td class="px-2 py-3 text-gray-900 dark:text-white">
            <DestinationSummary :alias="alias" />
          </td>
          <td class="px-2 py-3 text-gray-900 dark:text-white">
            <AliasDomainText :alias="alias" />
          </td>
          <td v-if="groupwareEnabled" class="px-2 py-3" data-field="groupwareVisible">
            <YesNoMark :value="alias.groupwareVisible" />
          </td>
          <td class="hidden px-2 py-3 break-words text-gray-900 xl:table-cell dark:text-white">
            {{ comment(alias.publicComment) }}
          </td>
          <td class="hidden px-2 py-3 break-words text-gray-900 xl:table-cell dark:text-white">
            {{ comment(alias.privateComment) }}
          </td>
          <td class="px-2 py-3" data-field="internal"><YesNoMark :value="alias.internal" /></td>
          <td class="px-2 py-3" data-field="active"><YesNoMark :value="alias.active" /></td>
          <td class="px-2 py-3 text-end"><slot name="actions" :alias="alias" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

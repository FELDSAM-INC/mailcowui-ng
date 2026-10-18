<script setup lang="ts">
// The domain list as a table from md up (FR-007, FR-011, FR-072): header cells, sorting from the
// headers of the visible sortable columns with `aria-sort`, and an expandable row for the values
// that are not columns. The maximum mailbox quota and the rate limit are columns from xl up and in
// the expandable row below it. The default mailbox quota is not shown (owner decision). Slots: `select-all` and `select` (UI 002 US5),
// `actions` (US4).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt, legacy, resolveText, type TextRef } from '@/i18n'
import type { Domain } from '@/api'
import type { SortOrder } from '@/shared/composables/useListState'
import { ChevronDownIcon } from '@/shared/icons'

import { useDomainFormat } from '../../format'
import type { DomainSort } from '../../list-state'
import ActiveBadge from './ActiveBadge.vue'
import DomainEntryDetails from './DomainEntryDetails.vue'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import RelayBadge from './RelayBadge.vue'
import TagChips from './TagChips.vue'
import UsageMeter from './UsageMeter.vue'

const props = withDefaults(
  defineProps<{
    domains: readonly Domain[]
    sort: DomainSort
    order: SortOrder
    canSeeDomainAdmins: boolean
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: DomainSort, order: SortOrder]; filterTag: [tag: string] }>()
const { t } = useI18n()
const format = useDomainFormat()
const expanded = ref(new Set<string>())

interface Column {
  key: string
  labelKey: TextRef
  sort?: DomainSort
  wide?: boolean
}

const COLUMNS: Column[] = [
  { key: 'mailboxes', labelKey: legacy('mailbox.mailboxes'), sort: 'mailboxes' },
  { key: 'aliases', labelKey: legacy('mailbox.aliases'), sort: 'aliases' },
  { key: 'quota', labelKey: legacy('mailbox.domain_quota'), sort: 'quotaAllocated' },
  { key: 'storage', labelKey: legacy('mailbox.stats'), sort: 'storageUsed' },
  {
    key: 'maxQuota',
    labelKey: legacy('mailbox.mailbox_quota'),
    sort: 'maxMailboxQuota',
    wide: true,
  },
  { key: 'rateLimit', labelKey: legacy('edit.ratelimit'), wide: true },
]

function ariaSort(key: DomainSort | undefined) {
  if (!key || key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(key: DomainSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

function toggle(name: string) {
  const next = new Set(expanded.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  expanded.value = next
}

const rowId = (name: string) => `domain-row-${name.replace(/[^a-z0-9-]/g, '-')}`
const columnCount = () => COLUMNS.length + 2 + (props.selectable ? 1 : 0)
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
    <table class="w-full table-auto text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.domains')
        }}
      </caption>
      <thead
        class="border-b border-gray-200 text-start text-gray-600 dark:border-gray-800 dark:text-gray-400"
      >
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-3 py-2"><slot name="select-all" /></th>
          <th scope="col" class="px-3 py-2 text-start font-medium" :aria-sort="ariaSort('name')">
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-1 font-medium hover:text-gray-900 dark:hover:text-white"
              @click="sortBy('name')"
            >
              {{ lt('mailbox.domain') }}
              <span aria-hidden="true">{{
                sort === 'name' ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
          </th>
          <th
            v-for="column in COLUMNS"
            :key="column.key"
            scope="col"
            class="px-3 py-2 text-start font-medium"
            :class="column.wide ? 'hidden xl:table-cell' : ''"
            :aria-sort="column.sort ? ariaSort(column.sort) : undefined"
          >
            <button
              v-if="column.sort"
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start font-medium hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.sort)"
            >
              {{ resolveText(column.labelKey, t) }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
            <template v-else>{{ resolveText(column.labelKey, t) }}</template>
          </th>
          <th scope="col" class="w-12 px-3 py-2">
            <span class="sr-only">{{ t('domains.list.details') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="domain in domains" :key="domain.name">
          <tr :data-entry="domain.name" class="align-top">
            <td v-if="selectable" class="px-3 py-3"><slot name="select" :domain="domain" /></td>
            <td class="max-w-72 px-3 py-3">
              <div class="flex flex-col gap-1.5">
                <div class="flex items-start gap-2">
                  <RouterLink
                    :to="{ name: 'domain-detail', params: { domain: domain.name } }"
                    class="inline-flex min-h-11 min-w-0 items-center font-semibold text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
                  >
                    <DomainNameText :name="domain.name" :unicode-name="domain.unicodeName" />
                  </RouterLink>
                  <slot name="actions" :domain="domain" />
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <ActiveBadge :active="domain.active" />
                  <RelayBadge :domain="domain" />
                </div>
                <TagChips :tags="domain.tags" :max="3" @filter="emit('filterTag', $event)" />
              </div>
            </td>
            <td class="px-3 py-3">
              <UsageMeter
                :label="lt('mailbox.mailboxes')"
                :used="domain.usage.mailboxes"
                :limit="domain.maxMailboxes"
                kind="count"
                usage-id="mailboxes"
                :show-label="false"
              />
            </td>
            <td class="px-3 py-3">
              <UsageMeter
                :label="lt('mailbox.aliases')"
                :used="domain.usage.aliases"
                :limit="domain.maxAliases"
                kind="count"
                usage-id="aliases"
                :show-label="false"
              />
            </td>
            <td class="px-3 py-3">
              <UsageMeter
                :label="lt('mailbox.domain_quota')"
                :used="domain.usage.quotaAllocated"
                :limit="domain.domainQuota"
                kind="size"
                usage-id="quota"
                :show-label="false"
              />
            </td>
            <td class="px-3 py-3 text-gray-900 dark:text-white">
              <div>{{ format.size(domain.usage.storageUsed) }}</div>
              <div class="text-gray-600 dark:text-gray-400">
                {{
                  t('domains.list.messagesCount', { count: format.count(domain.usage.messages) })
                }}
              </div>
            </td>
            <td class="hidden px-3 py-3 text-gray-900 xl:table-cell dark:text-white">
              {{ format.quota(domain.maxMailboxQuota) }}
            </td>
            <td class="hidden px-3 py-3 text-gray-900 xl:table-cell dark:text-white">
              {{ format.rateLimit(domain.rateLimit) }}
            </td>
            <td class="px-3 py-3">
              <button
                type="button"
                class="inline-flex size-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
                :aria-expanded="expanded.has(domain.name) ? 'true' : 'false'"
                :aria-controls="`${rowId(domain.name)}-details`"
                :aria-label="t('domains.list.detailsOf', { name: domain.unicodeName })"
                @click="toggle(domain.name)"
              >
                <ChevronDownIcon
                  class="size-5 motion-safe:transition-transform"
                  :class="expanded.has(domain.name) ? 'rotate-180' : ''"
                />
              </button>
            </td>
          </tr>
          <tr v-if="expanded.has(domain.name)" :id="`${rowId(domain.name)}-details`">
            <td
              :colspan="columnCount()"
              class="bg-gray-50 px-3 py-3 dark:bg-gray-950"
              :data-entry-details="domain.name"
            >
              <DomainEntryDetails :domain="domain" :can-see-domain-admins="canSeeDomainAdmins" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

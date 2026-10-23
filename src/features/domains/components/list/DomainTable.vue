<script setup lang="ts">
import DataIdentity from '@/shared/components/DataIdentity.vue'

import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

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
import RowControls from '@/shared/components/RowControls.vue'

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
    hidden?: boolean
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

const tableView = useDataColumns(
  () => [
    { id: 'name', label: lt('mailbox.domain'), sort: 'name' },
    ...COLUMNS.map((column) => ({
      id: column.key,
      label: resolveText(column.labelKey, t),
      sort: column.sort,
    })),
  ],
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
          lt('mailbox.domains')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-3 py-2"><slot name="select-all" /></th>
          <DataTableHeader
            :column="String(tableView.columns.value[0]!.id)"
            class="px-3 py-2 text-start"
          />
          <DataTableHeader
            v-for="column in COLUMNS"
            :key="column.key"
            :column="String(column.key)"
            class="px-3 py-2 text-start"
          />
          <th scope="col" class="table-controls-cell px-3 py-2">
            {{ lt('mailbox.action') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="domain in domains" :key="domain.name">
          <tr :data-entry="domain.name" class="align-top">
            <td v-if="selectable" class="px-3 py-3"><slot name="select" :domain="domain" /></td>
            <td
              v-show="tableView.visible(String('name'))"
              :data-column="String('name')"
              class="max-w-72 px-3 py-3"
            >
              <DataIdentity
                ><RouterLink
                  :to="{ name: 'domain-detail', params: { domain: domain.name } }"
                  class="inline-flex min-h-11 min-w-0 items-center font-semibold text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
                >
                  <DomainNameText
                    class="table-identity"
                    :title="domain.name"
                    :name="domain.name"
                    :unicode-name="domain.unicodeName"
                  /> </RouterLink
                ><template #badges
                  ><ActiveBadge :active="domain.active" /><RelayBadge :domain="domain" /></template
              ></DataIdentity>
            </td>
            <td
              v-show="tableView.visible(String('mailboxes'))"
              :data-column="String('mailboxes')"
              class="px-3 py-3"
            >
              <UsageMeter
                :label="lt('mailbox.mailboxes')"
                :used="domain.usage.mailboxes"
                :limit="domain.maxMailboxes"
                kind="count"
                usage-id="mailboxes"
                :show-label="false"
              />
            </td>
            <td
              v-show="tableView.visible(String('aliases'))"
              :data-column="String('aliases')"
              class="px-3 py-3"
            >
              <UsageMeter
                :label="lt('mailbox.aliases')"
                :used="domain.usage.aliases"
                :limit="domain.maxAliases"
                kind="count"
                usage-id="aliases"
                :show-label="false"
              />
            </td>
            <td
              v-show="tableView.visible(String('quota'))"
              :data-column="String('quota')"
              class="px-3 py-3"
            >
              <UsageMeter
                :label="lt('mailbox.domain_quota')"
                :used="domain.usage.quotaAllocated"
                :limit="domain.domainQuota"
                kind="size"
                usage-id="quota"
                :show-label="false"
              />
            </td>
            <td
              v-show="tableView.visible(String('storage'))"
              :data-column="String('storage')"
              class="px-3 py-3 text-gray-900 dark:text-white"
            >
              <div>{{ format.size(domain.usage.storageUsed) }}</div>
              <div class="text-gray-600 dark:text-gray-400">
                {{
                  t('domains.list.messagesCount', { count: format.count(domain.usage.messages) })
                }}
              </div>
            </td>
            <td
              v-show="tableView.visible(String('maxQuota'))"
              :data-column="String('maxQuota')"
              class="px-3 py-3 text-gray-900 dark:text-white"
            >
              {{ format.quota(domain.maxMailboxQuota) }}
            </td>
            <td
              v-show="tableView.visible(String('rateLimit'))"
              :data-column="String('rateLimit')"
              class="px-3 py-3 text-gray-900 dark:text-white"
            >
              {{ format.rateLimit(domain.rateLimit) }}
            </td>
            <td class="table-controls-cell px-3 py-3">
              <RowControls
                :expanded="expanded.has(domain.name)"
                :controls="`${rowId(domain.name)}-details`"
                :label="t('domains.list.detailsOf', { name: domain.unicodeName })"
                @toggle="toggle(domain.name)"
              >
                <slot name="actions" :domain="domain" />
              </RowControls>
            </td>
          </tr>
          <tr v-if="expanded.has(domain.name)" :id="`${rowId(domain.name)}-details`">
            <td
              :colspan="
                columnCount() - tableView.columns.value.length + tableView.visibleCount.value
              "
              class="bg-gray-50 px-3 py-3 dark:bg-gray-950"
              :data-entry-details="domain.name"
            >
              <DomainEntryDetails :domain="domain" :can-see-domain-admins="canSeeDomainAdmins" />
              <div v-if="domain.tags.length" class="mt-3">
                <div class="mb-1 text-sm text-gray-600 dark:text-gray-400">
                  {{ lt('add.tags') }}
                </div>
                <TagChips
                  :tags="domain.tags"
                  :max="domain.tags.length"
                  @filter="emit('filterTag', $event)"
                />
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

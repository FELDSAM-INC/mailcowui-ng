<script setup lang="ts">
import DataRow from '@/shared/components/DataRow.vue'

import DataIdentity from '@/shared/components/DataIdentity.vue'

import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

import ActiveBadge from '@/shared/components/ActiveBadge.vue'

// Keep the primary alias values visible and reveal comments and secondary flags on demand.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Alias } from '@/api'
import { lt, legacy, resolveText, type TextRef } from '@/i18n'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import YesNoMark from '@/shared/components/YesNoMark.vue'

import type { AliasSort } from '../list-state'
import AddressText from './AddressText.vue'
import AliasBadges from './AliasBadges.vue'
import AliasDomainText from './AliasDomainText.vue'
import DestinationSummary from './DestinationSummary.vue'

const props = withDefaults(
  defineProps<{
    hidden?: boolean
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
  { key: 'id', label: 'lists.id', sort: 'id', className: 'w-12' },
  { key: 'address', label: legacy('mailbox.alias'), sort: 'address', className: 'w-64' },
  { key: 'destinations', label: legacy('mailbox.target_address'), className: 'w-64' },
  { key: 'domain', label: legacy('mailbox.domain'), sort: 'domain', className: 'w-48' },
  { key: 'senderAllowed', label: legacy('edit.sender_allowed'), className: 'w-40' },
]
const expanded = ref(new Set<number>())
function toggle(id: number) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

function sortBy(key: AliasSort) {
  const order =
    key === props.sort ? (props.order === 'asc' ? 'desc' : 'asc') : key === 'id' ? 'desc' : 'asc'
  emit('sort', key, order)
}

const comment = (value: string) => value || '-'

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
    <table class="data-table w-full min-w-[54rem] table-fixed text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.aliases')
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
            :class="column.className"
          />
          <th scope="col" class="table-controls-cell px-2 py-2 text-end">
            <span class="sr-only">{{ lt('mailbox.action') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="alias in aliases" :key="alias.id">
          <DataRow
            :to="{ name: 'alias-detail', params: { aliasId: alias.id } }"
            :label="alias.address"
            :data-entry="alias.id"
            class="align-top"
          >
            <td v-if="selectable" class="px-2 py-3"><slot name="select" :alias="alias" /></td>
            <td
              v-show="tableView.visible(String('id'))"
              :data-column="String('id')"
              class="px-2 py-3 text-gray-700 dark:text-gray-300"
            >
              {{ alias.id }}
            </td>
            <td
              v-show="tableView.visible(String('address'))"
              :data-column="String('address')"
              class="px-2 py-3"
            >
              <DataIdentity
                ><span class="font-medium wrap-anywhere"
                  ><AddressText
                    class="table-identity"
                    :title="alias.address"
                    :address="alias.address"
                    :address-unicode="alias.addressUnicode" /></span
                ><template #badges
                  ><AliasBadges :alias="alias" :can-see-orphaned="canSeeOrphaned" /><ActiveBadge
                    :active="alias.active" /></template
              ></DataIdentity>
            </td>
            <td
              v-show="tableView.visible(String('destinations'))"
              :data-column="String('destinations')"
              class="px-2 py-3 text-gray-900 dark:text-white"
            >
              <DestinationSummary :alias="alias" />
            </td>
            <td
              v-show="tableView.visible(String('domain'))"
              :data-column="String('domain')"
              class="px-2 py-3 text-gray-900 dark:text-white"
            >
              <AliasDomainText class="table-identity" :title="alias.domainUnicode" :alias="alias" />
            </td>

            <td
              v-show="tableView.visible('senderAllowed')"
              data-column="senderAllowed"
              class="px-2 py-3"
            >
              <YesNoMark :value="alias.senderAllowed" />
            </td>
            <td class="table-controls-cell px-2 py-3">
              <RowControls
                :expanded="expanded.has(alias.id)"
                :controls="`alias-details-${alias.id}`"
                :label="`${t('domains.list.details')}: ${alias.addressUnicode}`"
                @toggle="toggle(alias.id)"
              >
                <slot name="actions" :alias="alias" />
              </RowControls>
            </td>
          </DataRow>
          <tr v-if="expanded.has(alias.id)" :id="`alias-details-${alias.id}`">
            <td
              :colspan="
                COLUMNS.length +
                1 +
                Number(selectable) -
                tableView.columns.value.length +
                tableView.visibleCount.value
              "
              class="px-4 py-3"
            >
              <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2" :data-entry-details="alias.id">
                <div v-if="groupwareEnabled" data-field="groupwareVisible">
                  <dt class="text-muted">{{ lt('mailbox.sogo_visible') }}</dt>
                  <dd><YesNoMark :value="alias.groupwareVisible" /></dd>
                </div>
                <div data-field="internal">
                  <dt class="text-muted">{{ lt('mailbox.internal') }}</dt>
                  <dd><YesNoMark :value="alias.internal" /></dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-muted">{{ lt('mailbox.public_comment') }}</dt>
                  <dd class="wrap-anywhere whitespace-normal">
                    {{ comment(alias.publicComment) }}
                  </dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-muted">{{ lt('mailbox.private_comment') }}</dt>
                  <dd class="wrap-anywhere whitespace-normal">
                    {{ comment(alias.privateComment) }}
                  </dd>
                </div>
              </dl>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

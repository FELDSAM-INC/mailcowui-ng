<script setup lang="ts">
// Keep the primary alias values visible and reveal comments and secondary flags on demand.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

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
  { key: 'active', label: legacy('mailbox.active'), sort: 'active', className: 'w-20' },
]
const expanded = ref(new Set<number>())
function toggle(id: number) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

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
  <div class="table-frame">
    <table class="data-table w-full min-w-[54rem] table-fixed text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.aliases')
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
            :class="column.className"
            :aria-sort="ariaSort(column.sort)"
          >
            <button
              v-if="column.sort"
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start break-words hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.sort)"
            >
              {{ resolveText(column.label, t) }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
            <span v-else class="break-words">{{ resolveText(column.label, t) }}</span>
          </th>
          <th scope="col" class="table-controls-cell px-2 py-2 text-end">
            <span class="sr-only">{{ lt('mailbox.action') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="alias in aliases" :key="alias.id">
          <tr :data-entry="alias.id" class="align-top">
            <td v-if="selectable" class="px-2 py-3"><slot name="select" :alias="alias" /></td>
            <td class="px-2 py-3 text-gray-700 dark:text-gray-300">
              {{ alias.id }}
            </td>
            <td class="px-2 py-3">
              <div class="flex min-w-0 flex-col gap-1.5">
                <RouterLink
                  :to="{ name: 'alias-detail', params: { aliasId: alias.id } }"
                  class="inline-flex min-h-11 max-w-full items-center font-medium text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
                >
                  <AddressText
                    class="table-identity"
                    :title="alias.address"
                    :address="alias.address"
                    :address-unicode="alias.addressUnicode"
                  />
                </RouterLink>
                <AliasBadges :alias="alias" :can-see-orphaned="canSeeOrphaned" />
              </div>
            </td>
            <td class="px-2 py-3 text-gray-900 dark:text-white">
              <DestinationSummary :alias="alias" />
            </td>
            <td class="px-2 py-3 text-gray-900 dark:text-white">
              <AliasDomainText class="table-identity" :title="alias.domainUnicode" :alias="alias" />
            </td>
            <td class="px-2 py-3" data-field="active"><YesNoMark :value="alias.active" /></td>
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
          </tr>
          <tr v-if="expanded.has(alias.id)" :id="`alias-details-${alias.id}`">
            <td :colspan="COLUMNS.length + 1 + Number(selectable)" class="px-4 py-3">
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

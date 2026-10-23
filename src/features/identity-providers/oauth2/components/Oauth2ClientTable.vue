<script setup lang="ts">
import DataRow from '@/shared/components/DataRow.vue'

import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

// The OAuth2 clients as a table from md up (FR-055), with the classic list's columns ID, Client
// ID, Redirect URI and Action (`admin.js` draw_oauth2_clients; no secret column, owner decision).
// The first three sort from their headers with `aria-sort`. Slots: `select-all`, `select`,
// `actions`.
import { useI18n } from 'vue-i18n'

import { lt, resolveText } from '@/i18n'
import type { Oauth2Client } from '@/api'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import { SORT_LABELS } from '../columns'
import type { Oauth2ClientSort } from '../list-state'
import RedirectUriList from './RedirectUriList.vue'

const props = withDefaults(
  defineProps<{
    hidden?: boolean
    clients: readonly Oauth2Client[]
    sort: Oauth2ClientSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: Oauth2ClientSort, order: SortOrder] }>()
const { t } = useI18n()

const COLUMNS: Oauth2ClientSort[] = ['id', 'clientId', 'redirectUri']

function sortBy(key: Oauth2ClientSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const tableView = useDataColumns(
  () =>
    COLUMNS.map((column) => ({
      id: column,
      label: resolveText(SORT_LABELS[column], t),
      sort: column,
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
    <table class="data-table w-full table-fixed text-sm">
      <caption class="sr-only">
        {{
          lt('admin.oauth2_apps')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-16 px-3 py-2"><slot name="select-all" /></th>
          <DataTableHeader
            v-for="column in COLUMNS"
            :key="column"
            :column="String(column)"
            class="px-3 py-2 text-start"
            :class="column === 'id' ? 'w-20' : column === 'clientId' ? 'w-44' : ''"
          />
          <th scope="col" class="table-controls-cell px-3 py-2 text-end">
            {{ lt('admin.action') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <DataRow
          v-for="client in clients"
          :key="client.id"
          :to="{ name: 'oauth2-client-detail', params: { oauth2ClientId: client.id } }"
          :label="client.clientId"
          :data-entry="client.id"
          class="align-top"
        >
          <td v-if="selectable" class="px-3 py-3"><slot name="select" :client="client" /></td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[0]!.id))"
            :data-column="String(tableView.columns.value[0]!.id)"
            class="px-3 py-3 text-gray-900 dark:text-white"
          >
            {{ client.id }}
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[1]!.id))"
            :data-column="String(tableView.columns.value[1]!.id)"
            class="px-3 py-3"
          >
            <span class="font-medium wrap-anywhere">{{ client.clientId }}</span>
          </td>
          <td
            v-show="tableView.visible(String(tableView.columns.value[2]!.id))"
            :data-column="String(tableView.columns.value[2]!.id)"
            class="min-w-0 px-3 py-3 text-gray-900 dark:text-white"
          >
            <RedirectUriList :uris="client.redirectUris" />
          </td>
          <td class="table-controls-cell px-3 py-3">
            <RowControls><slot name="actions" :client="client" /></RowControls>
          </td>
        </DataRow>
      </tbody>
    </table>
  </div>
</template>

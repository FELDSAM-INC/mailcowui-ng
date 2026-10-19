<script setup lang="ts">
// Transport Maps (UI 009 US3; legacy form map part 1a): the classic transport card as a list with
// the MX-based mark in text, legacy's buttons (Test, Edit, Remove) and History, and legacy's quick
// actions in selection mode.
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { queryKeys, type Transport } from '@/api'
import { lt } from '@/i18n'

import {
  applyTransportBulkAction,
  deleteTransport,
  fetchTransport,
  fetchTransports,
} from '../../api/transports'
import EntryActions from '../../components/common/EntryActions.vue'
import RoutingListScreen from '../../components/common/RoutingListScreen.vue'
import StatusText from '../../components/common/StatusText.vue'
import { transportColumns, transportSorts } from '../../components/transports/transport-columns'
import { useEntryDeletion } from '../../composables/useEntryDeletion'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { useRoutingList } from '../../composables/useRoutingList'
import { historyTarget } from '../../history'
import { useTransportListState } from '../../list-states/transports'
import { BULK_ACTIONS, targetOf } from '../../logic/bulk-actions'

const { t } = useI18n()
const client = useQueryClient()
const router = useRouter()
const { canSeeHistory } = useRoutingIdentity()

const controller = useRoutingList<
  Transport,
  ReturnType<typeof useTransportListState>['params']['value']
>({
  collection: 'transports',
  state: (options) => useTransportListState(options),
  queryKey: (params) => queryKeys.transports.list(params),
  fetch: fetchTransports,
  idOf: (item) => String(item.id),
  nameOf: (item) => item.destination,
  targetOf,
  sendBulk: (queryClient, action, targets) =>
    applyTransportBulkAction(queryClient, {
      action: action as (typeof BULK_ACTIONS.transports)[number],
      targets,
    }),
  bulkMessage: (row, entry, action) => {
    if (row.outcome !== 'done') return null
    return action === 'delete'
      ? lt('success.relayhost_removed', row.id)
      : lt('success.object_modified', entry?.destination ?? row.label)
  },
})

const deletion = useEntryDeletion<Transport>({
  nameOf: (entry) => entry.destination,
  remove: (entry) => deleteTransport(client, entry.id, entry.etag),
  reload: (entry) => fetchTransport(entry.id),
  success: (entry) => lt('success.relayhost_removed', String(entry.id)),
})

const columns = computed(() => transportColumns(t))
const yesNo = computed(() => [
  { value: 'true', label: t('routing.filters.yes') },
  { value: 'false', label: t('routing.filters.no') },
])
const filters = computed(() => [
  {
    key: 'active',
    label: lt('admin.active'),
    kind: 'select' as const,
    options: [
      { value: 'true', label: lt('admin.active') },
      { value: 'false', label: lt('admin.inactive') },
    ],
  },
  { key: 'mxBased', label: lt('admin.is_mx_based'), kind: 'select' as const, options: yesNo.value },
  { key: 'nextHop', label: lt('admin.nexthop'), kind: 'text' as const },
])
const sorts = computed(() => transportSorts(t))
const edit = (item: Transport) => ({
  name: 'routing-transport-edit',
  params: { transportId: item.id },
})
const testTo = (item: Transport) =>
  router.hasRoute('routing-transport-test')
    ? { name: 'routing-transport-test', params: { transportId: item.id } }
    : null
</script>

<template>
  <RoutingListScreen
    screen="transports"
    :controller="controller"
    :columns="columns"
    :filters="filters"
    :sorts="sorts"
    default-sort="id"
    primary="destination"
    :actions-label="lt('admin.action')"
    :bulk-actions="BULK_ACTIONS.transports"
    writable
    :add-to="{ name: 'routing-transport-create' }"
    :add-label="lt('admin.add_transport')"
    :edit-to="edit"
  >
    <template #cell-destination="{ entry }">
      <span class="flex flex-col items-start">
        <RouterLink
          :to="edit(entry)"
          class="inline-flex min-h-11 min-w-11 items-center font-semibold wrap-anywhere text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
        >
          {{ entry.destination }}
        </RouterLink>
        <span v-if="entry.mxBased" class="text-sm text-gray-700 dark:text-gray-300" data-mx-based>
          {{ lt('admin.is_mx_based') }}
        </span>
      </span>
    </template>
    <template #cell-active="{ entry }"><StatusText :value="entry.active" /></template>
    <template #actions="{ entry }">
      <EntryActions
        :name="entry.destination"
        section="admin"
        :test-to="testTo(entry)"
        :edit-to="edit(entry)"
        removable
        :history="canSeeHistory ? historyTarget('transport', entry) : null"
        @remove="deletion.start(entry)"
      />
    </template>
  </RoutingListScreen>
</template>

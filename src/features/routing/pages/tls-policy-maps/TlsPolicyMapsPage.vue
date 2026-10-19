<script setup lang="ts">
// TLS policy maps (UI 009 US6; `templates/mailbox/tab-tls-policy.twig`, legacy form map part 1a):
// the classic list with the raw policies, legacy's buttons (Edit, Remove) and History, and legacy's
// quick actions.
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { queryKeys, tlsPolicyValues, type TlsPolicyMap } from '@/api'
import { lt } from '@/i18n'

import {
  applyTlsPolicyMapBulkAction,
  deleteTlsPolicyMap,
  fetchTlsPolicyMap,
  fetchTlsPolicyMaps,
} from '../../api/tls-policy-maps'
import EntryActions from '../../components/common/EntryActions.vue'
import RoutingListScreen from '../../components/common/RoutingListScreen.vue'
import StatusText from '../../components/common/StatusText.vue'
import {
  tlsPolicyMapColumns,
  tlsPolicyMapSorts,
} from '../../components/tls-policy-maps/tls-policy-map-columns'
import { useEntryDeletion } from '../../composables/useEntryDeletion'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { useRoutingList } from '../../composables/useRoutingList'
import { historyTarget } from '../../history'
import { useTlsPolicyMapListState } from '../../list-states/tls-policy-maps'
import { BULK_ACTIONS, targetOf } from '../../logic/bulk-actions'

const { t } = useI18n()
const client = useQueryClient()
const { canSeeHistory } = useRoutingIdentity()

const controller = useRoutingList<
  TlsPolicyMap,
  ReturnType<typeof useTlsPolicyMapListState>['params']['value']
>({
  collection: 'tlsPolicyMaps',
  state: (options) => useTlsPolicyMapListState(options),
  queryKey: (params) => queryKeys.tlsPolicyMaps.list(params),
  fetch: fetchTlsPolicyMaps,
  idOf: (item) => String(item.id),
  nameOf: (item) => item.destination,
  targetOf,
  sendBulk: (queryClient, action, targets) =>
    applyTlsPolicyMapBulkAction(queryClient, {
      action: action as (typeof BULK_ACTIONS.tlsPolicyMaps)[number],
      targets,
    }),
  bulkMessage: (row, entry, action) => {
    if (row.outcome !== 'done') return null
    return action === 'delete'
      ? lt('success.tls_policy_map_entry_deleted', row.id)
      : lt('success.tls_policy_map_entry_saved', entry?.destination ?? row.label)
  },
})

const deletion = useEntryDeletion<TlsPolicyMap>({
  nameOf: (entry) => entry.destination,
  remove: (entry) => deleteTlsPolicyMap(client, entry.id, entry.etag),
  reload: (entry) => fetchTlsPolicyMap(entry.id),
  success: (entry) => lt('success.tls_policy_map_entry_deleted', String(entry.id)),
})

const columns = computed(() => tlsPolicyMapColumns(t))
const filters = computed(() => [
  {
    key: 'policy',
    label: lt('mailbox.tls_map_policy'),
    kind: 'checks' as const,
    options: tlsPolicyValues.map((value) => ({ value, label: value })),
  },
  {
    key: 'active',
    label: lt('mailbox.active'),
    kind: 'select' as const,
    options: [
      { value: 'true', label: lt('mailbox.active') },
      { value: 'false', label: lt('mailbox.inactive') },
    ],
  },
])
const sorts = computed(() => tlsPolicyMapSorts(t))
const edit = (item: TlsPolicyMap) => ({
  name: 'routing-tls-policy-map-edit',
  params: { tlsPolicyMapId: item.id },
})
</script>

<template>
  <RoutingListScreen
    screen="tlsPolicyMaps"
    :controller="controller"
    :columns="columns"
    :filters="filters"
    :sorts="sorts"
    default-sort="id"
    primary="destination"
    :actions-label="lt('mailbox.action')"
    :bulk-actions="BULK_ACTIONS.tlsPolicyMaps"
    writable
    :add-to="{ name: 'routing-tls-policy-map-create' }"
    :add-label="lt('mailbox.add_tls_policy_map')"
    :edit-to="edit"
  >
    <template #cell-policy="{ entry }">
      <b translate="no">{{ entry.policy }}</b>
    </template>
    <template #cell-parameters="{ entry }">
      <code translate="no" class="wrap-anywhere">{{ entry.parameters || '-' }}</code>
    </template>
    <template #cell-active="{ entry }"><StatusText :value="entry.active" /></template>
    <template #actions="{ entry }">
      <EntryActions
        :name="entry.destination"
        section="mailbox"
        :edit-to="edit(entry)"
        removable
        :history="canSeeHistory ? historyTarget('tlsPolicyMap', entry) : null"
        @remove="deletion.start(entry)"
      />
    </template>
  </RoutingListScreen>
</template>

<script setup lang="ts">
// Sender-dependent transports (UI 009 US1; legacy form map part 1a): the classic relayhost card as
// a list with the usage as counts linking to the usage view, legacy's buttons (Test, Edit,
// Remove) and History, and legacy's quick actions in selection mode.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { Relayhost } from '@/api'
import { lt } from '@/i18n'
import { useQueryClient } from '@tanstack/vue-query'

import {
  applyRelayhostBulkAction,
  deleteRelayhost,
  fetchRelayhost,
  fetchRelayhosts,
} from '../../api/relayhosts'
import { queryKeys } from '@/api'
import EntryActions from '../../components/common/EntryActions.vue'
import RoutingListScreen from '../../components/common/RoutingListScreen.vue'
import StatusText from '../../components/common/StatusText.vue'
import RelayhostDeleteImpact from '../../components/relayhosts/RelayhostDeleteImpact.vue'
import {
  relayhostColumns,
  relayhostName,
  relayhostSorts,
} from '../../components/relayhosts/relayhost-columns'
import { useEntryDeletion } from '../../composables/useEntryDeletion'
import { useRoutingList } from '../../composables/useRoutingList'
import { useRelayhostListState } from '../../list-states/relayhosts'
import { BULK_ACTIONS, targetOf } from '../../logic/bulk-actions'

const { t } = useI18n()
const client = useQueryClient()
const router = useRouter()

const controller = useRoutingList<
  Relayhost,
  ReturnType<typeof useRelayhostListState>['params']['value']
>({
  collection: 'relayhosts',
  state: (options) => useRelayhostListState(options),
  queryKey: (params) => queryKeys.relayhosts.list(params),
  fetch: fetchRelayhosts,
  idOf: (item) => String(item.id),
  nameOf: relayhostName,
  targetOf,
  sendBulk: (queryClient, action, targets) =>
    applyRelayhostBulkAction(queryClient, {
      action: action as (typeof BULK_ACTIONS.relayhosts)[number],
      targets,
    }),
  bulkMessage: (row, entry, action) => {
    if (row.outcome !== 'done') return null
    return action === 'delete'
      ? lt('success.relayhost_removed', row.id)
      : lt('success.object_modified', entry?.host ?? row.label)
  },
  deleteImpact: (entries) => ({ component: RelayhostDeleteImpact, props: { relayhosts: entries } }),
})

const deletion = useEntryDeletion<Relayhost>({
  nameOf: relayhostName,
  impact: (entry) => ({ component: RelayhostDeleteImpact, props: { relayhosts: [entry] } }),
  remove: (entry) => deleteRelayhost(client, entry.id, entry.etag),
  reload: (entry) => fetchRelayhost(entry.id),
  success: (entry) => lt('success.relayhost_removed', String(entry.id)),
})

const columns = computed(() => relayhostColumns(t))
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
  {
    key: 'inUse',
    label: lt('admin.in_use_by'),
    kind: 'select' as const,
    options: [
      { value: 'true', label: t('routing.filters.yes') },
      { value: 'false', label: t('routing.filters.no') },
    ],
  },
])
const sorts = computed(() => relayhostSorts(t))
const edit = (item: Relayhost) => ({
  name: 'routing-relayhost-edit',
  params: { relayhostId: item.id },
})
</script>

<template>
  <RoutingListScreen
    screen="relayhosts"
    :controller="controller"
    :columns="columns"
    :filters="filters"
    :sorts="sorts"
    default-sort="id"
    primary="host"
    :actions-label="lt('admin.action')"
    :bulk-actions="BULK_ACTIONS.relayhosts"
    writable
    :add-to="{ name: 'routing-relayhost-create' }"
    :add-label="lt('admin.add_relayhost')"
    :edit-to="edit"
  >
    <template #cell-usage="{ entry }">
      <span data-usage class="flex flex-col wrap-anywhere"
        ><span>{{ `${lt('mailbox.domains')}: ${entry.usage.domains}` }}</span
        ><span>{{ `${lt('mailbox.mailboxes')}: ${entry.usage.mailboxes}` }}</span></span
      >
    </template>
    <template #cell-active="{ entry }"><StatusText :value="entry.active" /></template>
    <template #actions="{ entry }">
      <EntryActions
        :name="relayhostName(entry)"
        :usage-to="{ name: 'routing-relayhost-usage', params: { relayhostId: entry.id } }"
        section="admin"
        :test-to="
          router.hasRoute('routing-relayhost-test')
            ? { name: 'routing-relayhost-test', params: { relayhostId: entry.id } }
            : null
        "
        :edit-to="edit(entry)"
        removable
        @remove="deletion.start(entry)"
      />
    </template>
  </RoutingListScreen>
</template>

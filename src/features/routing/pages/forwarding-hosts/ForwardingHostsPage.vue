<script setup lang="ts">
// Forwarding hosts (UI 009 US8; `templates/admin/tab-config-fwdhosts.twig`, `draw_fwd_hosts()`,
// legacy form map part 1a): the classic columns with the spam filter in text, the source as a
// button that filters by it, legacy's Remove and History, legacy's quick actions, and the outcome
// of an addition handed over by the add page (every resulting address, added or already listed).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { queryKeys, type ForwardingHost } from '@/api'
import { lt } from '@/i18n'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { CheckIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import {
  applyForwardingHostBulkAction,
  deleteForwardingHost,
  fetchForwardingHosts,
} from '../../api/forwarding-hosts'
import EntryActions from '../../components/common/EntryActions.vue'
import RoutingListScreen from '../../components/common/RoutingListScreen.vue'
import StatusText from '../../components/common/StatusText.vue'
import {
  forwardingHostColumns,
  forwardingHostSorts,
} from '../../components/forwarding-hosts/forwarding-host-columns'
import { useEntryDeletion } from '../../composables/useEntryDeletion'
import { useForwardingHostResults } from '../../composables/useForwardingHostResults'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { useRoutingList } from '../../composables/useRoutingList'
import { historyTarget } from '../../history'
import { useForwardingHostListState } from '../../list-states/forwarding-hosts'
import { BULK_ACTIONS, targetOf } from '../../logic/bulk-actions'

const { t } = useI18n()
const client = useQueryClient()
const { canSeeHistory } = useRoutingIdentity()

const controller = useRoutingList<
  ForwardingHost,
  ReturnType<typeof useForwardingHostListState>['params']['value']
>({
  collection: 'forwardingHosts',
  state: (options) => useForwardingHostListState(options),
  queryKey: (params) => queryKeys.forwardingHosts.list(params),
  fetch: fetchForwardingHosts,
  idOf: (item) => item.address,
  nameOf: (item) => item.address,
  targetOf,
  sendBulk: (queryClient, action, targets) =>
    applyForwardingHostBulkAction(queryClient, {
      action: action as (typeof BULK_ACTIONS.forwardingHosts)[number],
      targets,
    }),
  bulkMessage: (row, _entry, action) => {
    if (row.outcome !== 'done') return null
    return action === 'delete'
      ? lt('success.forwarding_host_removed', row.id)
      : lt('success.object_modified', row.id)
  },
})

const deletion = useEntryDeletion<ForwardingHost>({
  nameOf: (entry) => entry.address,
  remove: (entry) => deleteForwardingHost(client, entry.address, entry.etag),
  // Legacy has no entry page, so the entry is looked up in the list (legacy form map, decision 9).
  reload: async (entry) =>
    (await fetchForwardingHosts({ q: entry.address, limit: 100 })).data.find(
      (item) => item.address === entry.address,
    ),
  success: (entry) => lt('success.forwarding_host_removed', entry.address),
})

const source = computed(() => controller.list.state.value.filters.source as string | undefined)

// The outcome of an addition, read once (a reload drops it; the source filter keeps the list).
const outcome = shallowRef(useForwardingHostResults().take(source.value))
const added = computed(() =>
  (outcome.value?.entries ?? [])
    .filter((item) => item.outcome === 'added')
    .map((item) => item.forwardingHost.address),
)
const updated = computed(() =>
  (outcome.value?.entries ?? [])
    .filter((item) => item.outcome === 'updated')
    .map((item) => item.forwardingHost.address),
)
const outcomeLines = computed(() => [
  ...(added.value.length ? [lt('success.forwarding_host_added', added.value.join(', '))] : []),
  ...(updated.value.length
    ? [t('routing.forwardingHosts.updated', { addresses: updated.value.join(', ') })]
    : []),
])
if (outcomeLines.value.length) announce(outcomeLines.value.join(' '))

const columns = computed(() => forwardingHostColumns())
const filters = computed(() => [
  {
    key: 'spamFilter',
    label: lt('admin.spamfilter'),
    kind: 'select' as const,
    options: [
      { value: 'true', label: lt('admin.active') },
      { value: 'false', label: lt('admin.inactive') },
    ],
  },
  { key: 'source', label: lt('admin.source'), kind: 'text' as const },
])
const sorts = computed(() => forwardingHostSorts())
</script>

<template>
  <RoutingListScreen
    screen="forwardingHosts"
    :controller="controller"
    :columns="columns"
    :filters="filters"
    :sorts="sorts"
    default-sort="address"
    primary="address"
    :actions-label="lt('admin.action')"
    :bulk-actions="BULK_ACTIONS.forwardingHosts"
    writable
    :add-to="{ name: 'routing-forwarding-host-create' }"
    :add-label="lt('admin.add_forwarding_host')"
  >
    <template #before-toolbar>
      <div
        v-if="outcomeLines.length"
        data-forwarding-results
        class="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
      >
        <CheckIcon class="mt-0.5 size-5 shrink-0" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p v-for="line in outcomeLines" :key="line" class="wrap-anywhere">{{ line }}</p>
        </div>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline', size: 'sm' })"
          @click="outcome = null"
        >
          {{ t('common.close') }}
        </button>
      </div>
    </template>
    <template #before-list>
      <div v-if="canSeeHistory && source !== undefined" class="flex">
        <HistoryLink
          :target-type="historyTarget('forwardingHost', { address: source }).targetType"
          :target-id="source"
          :label="t('routing.forwardingHosts.historyOfSource')"
        />
      </div>
    </template>
    <template #cell-address="{ entry }">
      <span translate="no" class="font-semibold wrap-anywhere text-gray-900 dark:text-white">{{
        entry.address
      }}</span>
    </template>
    <template #cell-source="{ entry }">
      <button
        v-if="entry.source !== ''"
        type="button"
        translate="no"
        class="inline-flex min-h-11 min-w-11 items-center text-left wrap-anywhere text-accent-text bg-white dark:bg-gray-900 underline underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
        :aria-pressed="source === entry.source ? 'true' : 'false'"
        @click="controller.list.setFilter('source', entry.source)"
      >
        {{ entry.source }}
      </button>
    </template>
    <template #cell-spamFilter="{ entry }"><StatusText :value="entry.spamFilter" /></template>
    <template #actions="{ entry }">
      <EntryActions
        :name="entry.address"
        section="admin"
        removable
        @remove="deletion.start(entry)"
      />
    </template>
  </RoutingListScreen>
</template>

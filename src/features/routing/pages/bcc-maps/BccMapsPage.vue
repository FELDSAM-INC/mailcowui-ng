<script setup lang="ts">
// BCC maps (UI 009 US5; the BCC card of `templates/mailbox/tab-bcc.twig`, legacy form map part 1a):
// for administrators every map, orphaned ones labelled; for domain administrators the maps of
// their domains, changeable with the BCC maps permission (legacy's `data-acl` on the write
// controls) and otherwise read-only.
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { queryKeys, type BccMap } from '@/api'
import { lt } from '@/i18n'

import { applyBccMapBulkAction, deleteBccMap, fetchBccMap, fetchBccMaps } from '../../api/bcc-maps'
import { bccMapColumns, bccMapSorts, bccTypeLabel } from '../../components/bcc-maps/bcc-map-columns'
import EntryActions from '../../components/common/EntryActions.vue'
import RoutingListScreen from '../../components/common/RoutingListScreen.vue'
import StatusText from '../../components/common/StatusText.vue'
import { useEntryDeletion } from '../../composables/useEntryDeletion'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { useRoutingList } from '../../composables/useRoutingList'
import { historyTarget } from '../../history'
import { useBccMapListState } from '../../list-states/bcc-maps'
import { BULK_ACTIONS, targetOf } from '../../logic/bulk-actions'
import { conflictText } from '../../problems'

const { t } = useI18n()
const client = useQueryClient()
const { identity, isAdmin, canWriteBcc, canSeeHistory } = useRoutingIdentity()

const controller = useRoutingList<BccMap, ReturnType<typeof useBccMapListState>['params']['value']>(
  {
    collection: 'bccMaps',
    state: (options) => useBccMapListState(() => isAdmin.value, options),
    queryKey: (params) => queryKeys.bccMaps.list(params),
    fetch: fetchBccMaps,
    idOf: (item) => String(item.id),
    nameOf: (item) => item.localDestination,
    targetOf,
    sendBulk: (queryClient, action, targets) =>
      applyBccMapBulkAction(queryClient, {
        action: action as (typeof BULK_ACTIONS.bccMaps)[number],
        targets,
      }),
    bulkMessage: (row, entry, action) => {
      if (row.outcome === 'done') {
        return action === 'delete'
          ? lt('success.bcc_deleted', row.id)
          : lt('success.bcc_edited', entry?.bccDestination ?? '')
      }
      if (row.outcome === 'refused' && row.problem && entry) {
        return conflictText('bccMap', row.problem, {
          localDestination: entry.localDestination,
          type: action === 'switchToSender' ? 'sender' : 'recipient',
        })
      }
      return null
    },
    enabled: () => !!identity.value,
  },
)

const deletion = useEntryDeletion<BccMap>({
  nameOf: (entry) => entry.localDestination,
  remove: (entry) => deleteBccMap(client, entry.id, entry.etag),
  reload: (entry) => fetchBccMap(entry.id),
  success: (entry) => lt('success.bcc_deleted', String(entry.id)),
})

const columns = computed(() => bccMapColumns(t))
const scopeDomains = computed(() => {
  const scope = identity.value?.scope
  return scope?.type === 'domains' ? scope.domains : []
})
const filters = computed(() => [
  {
    key: 'type',
    label: lt('mailbox.bcc_type'),
    kind: 'select' as const,
    options: [
      { value: 'sender', label: lt('mailbox.bcc_sender_map') },
      { value: 'recipient', label: lt('mailbox.bcc_rcpt_map') },
    ],
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
  isAdmin.value
    ? { key: 'domain', label: lt('mailbox.domain'), kind: 'textList' as const }
    : {
        key: 'domain',
        label: lt('mailbox.domain'),
        kind: 'checks' as const,
        options: scopeDomains.value.map((name) => ({ value: name, label: name })),
      },
  ...(isAdmin.value
    ? [
        {
          key: 'orphaned',
          label: t('routing.bccMaps.orphaned'),
          kind: 'select' as const,
          options: [
            { value: 'true', label: t('routing.filters.yes') },
            { value: 'false', label: t('routing.filters.no') },
          ],
        },
      ]
    : []),
])
const sorts = computed(() => bccMapSorts(t))
const edit = (item: BccMap) => ({ name: 'routing-bcc-map-edit', params: { bccMapId: item.id } })
</script>

<template>
  <RoutingListScreen
    screen="bccMaps"
    :controller="controller"
    :columns="columns"
    :filters="filters"
    :sorts="sorts"
    default-sort="id"
    primary="localDestination"
    :actions-label="lt('mailbox.action')"
    :bulk-actions="BULK_ACTIONS.bccMaps"
    :writable="canWriteBcc"
    :add-to="{ name: 'routing-bcc-map-create' }"
    :add-label="lt('mailbox.add_bcc_entry')"
    :edit-to="edit"
  >
    <template #cell-localDestination="{ entry }">
      <RouterLink
        :to="edit(entry)"
        class="inline-flex min-h-11 min-w-11 items-center font-semibold wrap-anywhere text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
      >
        {{ entry.localDestination }}
      </RouterLink>
    </template>
    <template #cell-type="{ entry }">{{ bccTypeLabel(entry.type) }}</template>
    <template #cell-domain="{ entry }">
      <span class="flex flex-col items-start">
        <span>{{ entry.domain }}</span>
        <span
          v-if="entry.orphaned"
          class="text-sm text-amber-800 dark:text-amber-200"
          data-orphaned
        >
          {{ t('routing.bccMaps.orphaned') }}
        </span>
      </span>
    </template>
    <template #cell-active="{ entry }"><StatusText :value="entry.active" /></template>
    <template #actions="{ entry }">
      <EntryActions
        :name="entry.localDestination"
        section="mailbox"
        :edit-to="canWriteBcc ? edit(entry) : null"
        :removable="canWriteBcc"
        :history="canSeeHistory ? historyTarget('bccMap', entry) : null"
        @remove="deletion.start(entry)"
      />
    </template>
  </RoutingListScreen>
</template>

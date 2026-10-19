<script setup lang="ts">
// Recipient maps (UI 009 US7; the recipient map card of `templates/mailbox/tab-bcc.twig`, legacy
// form map part 1a): the classic list, legacy's buttons (Edit, Remove) and History, and legacy's
// quick actions.
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { queryKeys, type RecipientMap } from '@/api'
import { lt } from '@/i18n'

import {
  applyRecipientMapBulkAction,
  deleteRecipientMap,
  fetchRecipientMap,
  fetchRecipientMaps,
} from '../../api/recipient-maps'
import EntryActions from '../../components/common/EntryActions.vue'
import RoutingListScreen from '../../components/common/RoutingListScreen.vue'
import StatusText from '../../components/common/StatusText.vue'
import {
  recipientMapColumns,
  recipientMapSorts,
} from '../../components/recipient-maps/recipient-map-columns'
import { useEntryDeletion } from '../../composables/useEntryDeletion'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { useRoutingList } from '../../composables/useRoutingList'
import { historyTarget } from '../../history'
import { useRecipientMapListState } from '../../list-states/recipient-maps'
import { BULK_ACTIONS, targetOf } from '../../logic/bulk-actions'

const { t } = useI18n()
const client = useQueryClient()
const { canSeeHistory } = useRoutingIdentity()

const controller = useRoutingList<
  RecipientMap,
  ReturnType<typeof useRecipientMapListState>['params']['value']
>({
  collection: 'recipientMaps',
  state: (options) => useRecipientMapListState(options),
  queryKey: (params) => queryKeys.recipientMaps.list(params),
  fetch: fetchRecipientMaps,
  idOf: (item) => String(item.id),
  nameOf: (item) => item.originalDestination,
  targetOf,
  sendBulk: (queryClient, action, targets) =>
    applyRecipientMapBulkAction(queryClient, {
      action: action as (typeof BULK_ACTIONS.recipientMaps)[number],
      targets,
    }),
  bulkMessage: (row, entry, action) => {
    if (row.outcome !== 'done') return null
    return action === 'delete'
      ? lt('success.recipient_map_entry_deleted', row.id)
      : lt('success.recipient_map_entry_saved', entry?.originalDestination ?? row.label)
  },
})

const deletion = useEntryDeletion<RecipientMap>({
  nameOf: (entry) => entry.originalDestination,
  remove: (entry) => deleteRecipientMap(client, entry.id, entry.etag),
  reload: (entry) => fetchRecipientMap(entry.id),
  success: (entry) => lt('success.recipient_map_entry_deleted', String(entry.id)),
})

const columns = computed(() => recipientMapColumns(t))
const filters = computed(() => [
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
const sorts = computed(() => recipientMapSorts(t))
const edit = (item: RecipientMap) => ({
  name: 'routing-recipient-map-edit',
  params: { recipientMapId: item.id },
})
</script>

<template>
  <RoutingListScreen
    screen="recipientMaps"
    :controller="controller"
    :columns="columns"
    :filters="filters"
    :sorts="sorts"
    default-sort="id"
    primary="originalDestination"
    :actions-label="lt('mailbox.action')"
    :bulk-actions="BULK_ACTIONS.recipientMaps"
    writable
    :add-to="{ name: 'routing-recipient-map-create' }"
    :add-label="lt('mailbox.add_recipient_map_entry')"
    :edit-to="edit"
  >
    <template #cell-active="{ entry }"><StatusText :value="entry.active" /></template>
    <template #actions="{ entry }">
      <EntryActions
        :name="entry.originalDestination"
        section="mailbox"
        :edit-to="edit(entry)"
        removable
        :history="canSeeHistory ? historyTarget('recipientMap', entry) : null"
        @remove="deletion.start(entry)"
      />
    </template>
  </RoutingListScreen>
</template>

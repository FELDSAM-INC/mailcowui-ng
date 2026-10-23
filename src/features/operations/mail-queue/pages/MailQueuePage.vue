<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

import ListToolbar from '@/shared/components/ListToolbar.vue'
import { useDataList } from '@/shared/composables/useDataList'

// The Queue Manager (UI 011 US4, FR-050 to FR-062), mirroring `templates/queue.twig`: the title
// with the number of queued messages, Refresh, the explanation and the legend, the list with
// legacy's search, sortable columns and pages (cards below md, a table from md up), selection mode
// with "Toggle all" and the actions Deliver, Unhold, Hold and Remove in one request each, "Flush
// queue", and "Delete all" with its acknowledged confirmation. A message's content opens at its
// own address (`/operations/mail-queue/messages/<id>`) over the list. The list never refreshes on
// its own, except after an action.
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, nextTick, ref } from 'vue'
import { useListQueryState } from '@/shared/composables/useListQueryState'
import ListState from '@/shared/components/ListState.vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

import { problemOf, type MailQueueMessage } from '@/api'
import { useFilteredListAnnouncement } from '@/shared/composables/useFilteredListAnnouncement'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { TrashIcon, WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { useMonitoringCapabilities } from '../../capabilities'
import { mailQueueListOptions, type QueueAction } from '../api'
import MailServiceStopped from '../components/MailServiceStopped.vue'
import MessageContentViewer from '../components/MessageContentViewer.vue'
import PurgeQueueDialog from '../components/PurgeQueueDialog.vue'
import QueueDeleteList from '../components/QueueDeleteList.vue'
import QueueLegend from '../components/QueueLegend.vue'
import QueueMessageCard from '../components/QueueMessageCard.vue'
import QueueMessageTable from '../components/QueueMessageTable.vue'
import { useQueueActions } from '../composables/useQueueActions'
import { useMailQueueListState, type MailQueueSort } from '../list-state'

const props = defineProps<{ queueId?: string }>()

const { t } = useI18n()
const fmt = useFormat()
const route = useRoute()
const router = useRouter()
const wide = useMediaQuery('(min-width: 768px)')
const capabilities = useMonitoringCapabilities()
const selection = useBulkSelection({
  limit: () => capabilities.capabilities.value?.limits.mailQueueBulkMaxIds,
})
const list = useMailQueueListState({ onReset: () => selection.clear() })
const state = computed(() => list.state.value)
const actions = useQueueActions()

const query = useQuery(
  computed(() => ({
    ...mailQueueListOptions(list.params.value),
    placeholderData: keepPreviousData,
  })),
)
const messages = computed(() => query.data.value?.data ?? [])
const meta = computed(() => query.data.value?.meta)
const { total, initialLoading, loadFailed, empty, noMatches, listState } = useListQueryState(
  query,
  () => !!state.value.filters.q,
)
const queued = computed(() => meta.value?.queueCounts.total)

const stoppedContainer = computed(() => {
  const error = problemOf(query.error.value)
  if (error?.is('mail-service-not-running')) {
    const container = error.extensions.container
    return typeof container === 'string' ? container : null
  }
  return actions.stoppedContainer.value
})

// FR-086: the new count after a search is announced, without moving the focus.
useFilteredListAnnouncement(query, state, (data) => {
  const shown = data.data.length
  return data.meta.total === 0
    ? lt('datatables.zeroRecords')
    : lt('datatables.info', {
        _START_: fmt.number(data.meta.offset + 1),
        _END_: fmt.number(data.meta.offset + shown),
        _TOTAL_: fmt.number(data.meta.total),
      })
})
function onSearch(q: string) {
  void list.setFilter('q', q || undefined, { typing: true })
}

function setSort(sort: MailQueueSort, order: 'asc' | 'desc') {
  void list.setSort(sort, order)
}

function refresh() {
  actions.close()
  void query.refetch()
}

// The content viewer: its own address, over the list with the list's address kept.
function showLocation(message: MailQueueMessage): RouteLocationRaw {
  return {
    name: 'operations-mail-queue-message',
    params: { queueId: message.id },
    query: route.query,
  }
}

async function closeViewer() {
  const id = props.queueId
  // The focus returns to the opener once the list's address is back, after the app's own focus
  // handling of the navigation (which focuses the heading).
  const removeHook = router.afterEach(() => {
    removeHook()
    void nextTick(() =>
      nextTick(() =>
        requestAnimationFrame(() => {
          const opener = id
            ? document.querySelector<HTMLElement>(`[data-show-message="${CSS.escape(id)}"]`)
            : null
          ;(opener ?? document.querySelector<HTMLElement>('main h1'))?.focus()
        }),
      ),
    )
  })
  const target = router.resolve({ name: 'operations-mail-queue', query: route.query }).fullPath
  if (router.options.history.state.back === target) router.back()
  else await router.replace(target)
}

// Selection mode and the selection's actions, in legacy order (FR-054).
const pageIds = computed(() => messages.value.map((message) => message.id))
const allSelected = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selection.isSelected(id) || !selection.canSelect(id)),
)
const limitMessage = computed(() =>
  selection.limitReached.value && selection.limit.value !== null
    ? t('bulk.limitReached', { max: fmt.number(selection.limit.value) })
    : null,
)
const BULK_ACTIONS = computed(() => [
  { id: 'deliver', label: lt('queue.deliver_mail') },
  { id: 'release', label: lt('queue.unhold_mail') },
  { id: 'hold', label: lt('queue.hold_mail') },
  { id: 'delete', label: lt('mailbox.remove'), destructive: true },
])

function toggleAll(checked: boolean) {
  if (checked) selection.selectPage(pageIds.value)
  else selection.clear()
}

function toggleSelecting() {
  if (selection.active.value) selection.leave()
  else selection.enter()
}

const selected = () => messages.value.filter((message) => selection.isSelected(message.id))

async function runAction(id: string) {
  const targets = selected()
  if (targets.length === 0) return
  if (id === 'delete') {
    const count = targets.length
    const confirmed = await confirm({
      title: lt('footer.confirm_delete'),
      confirmLabel: lt('footer.delete_now'),
      destructive: true,
      content: { component: QueueDeleteList, props: { ids: targets.map((m) => m.id) } },
      requireTyped: {
        accepted: [String(count)],
        labelKey: 'bulk.confirm.typeCount',
        labelParams: { count },
      },
    })
    if (!confirmed) return
  }
  const succeeded = await actions.run(id as QueueAction, targets)
  if (succeeded) selection.clear()
}

const purgeOpen = ref(false)

function flush() {
  void actions.flush()
}

function purge() {
  void actions.purge()
}

useDataList('operations-mail-queue-pages-mailqueuepage', undefined, () => ({
  run: refresh,
  pending: query.isFetching.value,
  disabled: false,
}))
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex min-w-0 flex-wrap items-center gap-3">
        <h1
          tabindex="-1"
          class="text-2xl font-semibold wrap-anywhere text-gray-900 focus:outline-none dark:text-white"
        >
          {{ lt('queue.queue_manager') }}
        </h1>
        <Badge v-if="queued !== undefined" data-queue-total color="info">{{
          fmt.number(queued)
        }}</Badge>
      </div>
      <div class="flex shrink-0 flex-wrap gap-2">
        <HistoryLink target-type="mailQueue" />
      </div>
    </header>

    <QueueLegend />

    <ListToolbar
      ><template #select
        ><button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :aria-pressed="selection.active.value ? 'true' : 'false'"
          @click="toggleSelecting"
        >
          {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
        </button></template
      ><template #search
        ><SearchField
          id="mail-queue-search"
          :label="lt('datatables.search')"
          :model-value="state.filters.q ?? ''"
          @search="onSearch" /></template
    ></ListToolbar>

    <MailServiceStopped v-if="stoppedContainer" :container="stoppedContainer" />

    <template v-if="!stoppedContainer">
      <p
        v-if="meta?.truncated && capabilities.capabilities.value"
        data-queue-truncated
        role="note"
        class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <WarningIcon class="mt-0.5 size-4 shrink-0" />
        <span>{{
          t('operations.queue.truncated', {
            max: fmt.number(capabilities.capabilities.value.limits.mailQueueListingMax),
          })
        }}</span>
      </p>

      <p
        v-if="actions.status.value"
        data-queue-status
        role="status"
        class="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
      >
        {{ actions.status.value }}
      </p>
      <div
        v-if="actions.unknown.value"
        data-queue-unknown
        role="alert"
        class="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <p class="font-semibold">{{ t('bulk.outcome.unknown') }}</p>
        <p>{{ t('problem.outcome-unknown') }}</p>
      </div>
      <ProblemMessage v-else-if="actions.problem.value" :problem="actions.problem.value" />
      <p
        v-if="actions.notRecorded.value"
        data-not-recorded
        role="status"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        {{ t('operations.notRecorded') }}
      </p>
      <BulkResultSummary
        v-if="actions.rows.value.length > 0"
        :rows="actions.rows.value"
        @refresh="refresh"
        @close="actions.close"
      />

      <ListState
        :loading="initialLoading"
        :failed="loadFailed"
        :problem="problemOf(query.error.value)"
        :empty="empty"
        :no-matches="noMatches"
        :skeleton="32"
        empty-layout="plain"
        :empty-attrs="{ 'data-empty': '' }"
        :clear-label="t('lists.search.clear')"
        @clear="list.setFilter('q', undefined)"
        @retry="refresh"
      >
        <template #default>
          <div v-if="selection.active.value && !wide" class="flex items-center gap-2">
            <SelectCheckbox
              :label="lt('mailbox.toggle_all')"
              :checked="allSelected"
              @change="toggleAll"
            />
            <span aria-hidden="true" class="text-sm text-gray-700 dark:text-gray-300">{{
              lt('mailbox.toggle_all')
            }}</span>
          </div>
          <QueueMessageTable
            :hidden="!wide"
            :messages="messages"
            :sort="state.sort ?? 'arrivalTime'"
            :order="state.order ?? 'asc'"
            :selectable="selection.active.value"
            :show="showLocation"
            @sort="setSort"
          >
            <template #select-all>
              <SelectCheckbox
                :label="lt('mailbox.toggle_all')"
                :checked="allSelected"
                @change="toggleAll"
              />
            </template>
            <template #select="{ message }">
              <SelectCheckbox
                :label="t('bulk.selectItem', { name: message.id })"
                :checked="selection.isSelected(message.id)"
                :disabled="!selection.canSelect(message.id)"
                described-by="bulk-limit-message"
                @change="selection.toggle(message.id)"
              />
            </template>
          </QueueMessageTable>
          <ul v-if="!wide" :aria-label="lt('queue.queue_manager')" class="flex flex-col gap-3">
            <QueueMessageCard
              v-for="message in messages"
              :key="message.id"
              :message="message"
              :show="showLocation(message)"
            >
              <template v-if="selection.active.value" #select>
                <SelectCheckbox
                  :label="t('bulk.selectItem', { name: message.id })"
                  :checked="selection.isSelected(message.id)"
                  :disabled="!selection.canSelect(message.id)"
                  described-by="bulk-limit-message"
                  @change="selection.toggle(message.id)"
                />
              </template>
            </QueueMessageCard>
          </ul>
          <PaginationBar
            :total="total"
            :page="state.page"
            :size="state.size"
            :page-sizes="list.pageSizes"
            @update:page="list.setPage"
            @update:size="(size) => list.setSize(size as 25 | 50 | 100)"
          />
        </template>
      </ListState>

      <div v-if="!initialLoading && !loadFailed" class="flex flex-wrap gap-2">
        <button
          type="button"
          title="postqueue -f"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="actions.running.value"
          @click="flush"
        >
          {{ lt('queue.flush') }}
        </button>
        <button
          type="button"
          title="postsuper -d ALL"
          :class="buttonVariants({ variant: 'destructive' })"
          :disabled="actions.running.value"
          @click="purgeOpen = true"
        >
          <TrashIcon />
          {{ lt('queue.delete') }}
        </button>
      </div>
    </template>

    <PurgeQueueDialog v-model:open="purgeOpen" @confirm="purge" />

    <MessageContentViewer v-if="queueId" :key="queueId" :queue-id="queueId" @close="closeViewer" />

    <BulkActionBar
      v-if="selection.active.value"
      :count="selection.count.value"
      :actions="BULK_ACTIONS"
      :limit-message="limitMessage"
      :busy="actions.running.value"
      @action="runAction"
      @clear="selection.clear()"
    />
  </section>
</template>

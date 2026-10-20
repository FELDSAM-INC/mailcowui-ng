<script setup lang="ts">
// The caller's quarantine, with its view in the address and no automatic polling.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { isApiProblem, problemOf, type QuarantineItem } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import type { PageSize } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'

import type { OutcomeLine } from '../action-outcome'
import {
  forgetItem,
  quarantineItemOptions,
  quarantineListOptions,
  quarantineSettingsOptions,
  type ItemActionKind,
} from '../api'
import { useQuarantineCapabilities } from '../capabilities'
import ActionOutcomeMessage from '../components/ActionOutcomeMessage.vue'
import QuarantineBulkResultRow from '../components/bulk/QuarantineBulkResultRow.vue'
import QuarantineFilters from '../components/list/QuarantineFilters.vue'
import QuarantineItemList from '../components/list/QuarantineItemList.vue'
import QuarantineSortControl from '../components/list/QuarantineSortControl.vue'
import QuarantineSectionNav from '../components/QuarantineSectionNav.vue'
import QuarantineStatusNotice from '../components/QuarantineStatusNotice.vue'
import { useItemAction, type RereadResult } from '../composables/useItemAction'
import { useQuarantineBulk } from '../composables/useQuarantineBulk'
import { takeQuarantineFlash } from '../flash'
import { NO_FILTERS, useQuarantineListState } from '../list-state'
import { canActOnItems, missingFlag } from '../permissions'

const { t } = useI18n()
const fmt = useFormat()
const client = useQueryClient()
const wide = useMediaQuery('(min-width: 768px)')
const identity = useIdentityQuery()
const scoped = computed(() => !!identity.data.value && identity.data.value.role !== 'mailboxUser')
const scopeDomains = computed(() => {
  const scope = identity.data.value?.scope
  return scope?.type === 'domains' ? scope.domains : undefined
})
const canRemove = computed(() => canActOnItems(identity.data.value))
const aclFlag = computed(() => missingFlag(identity.data.value, 'actOnItems'))
const capabilities = useQuarantineCapabilities()
const selection = useBulkSelection({ limit: () => capabilities.data.value?.bulkLimit ?? 0 })
function clearSelection() {
  const hadSelection = selection.count.value > 0
  selection.clear()
  if (hadSelection) announce(t('bulk.selected', { count: 0 }))
}
const list = useQuarantineListState({ scoped, onReset: clearSelection })
const state = computed(() => list.state.value)
const query = useQuery(
  computed(() => ({ ...quarantineListOptions(list.params.value), enabled: !!identity.data.value })),
)
const settings = useQuery(quarantineSettingsOptions())
const items = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const flash = shallowRef(takeQuarantineFlash())
const selected = shallowRef<QuarantineItem>()
const asking = ref(false)
const bulk = useQuarantineBulk({
  selection,
  entries: () => items.value,
  refresh: () => query.refetch({ throwOnError: true }),
})
const pageIds = computed(() => items.value.map((item) => String(item.id)))
const allSelected = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selection.isSelected(id) || !selection.canSelect(id)),
)
const limitMessage = computed(() =>
  selection.limitReached.value
    ? t('bulk.limitReached', { max: fmt.number(selection.limit.value ?? 0) })
    : null,
)
const bulkActions = computed(() => [
  { id: 'release', label: lt('quarantine.deliver_inbox') },
  { id: 'releaseWithoutLearning', label: lt('quarantine.release') },
  { id: 'learnAsSpam', label: lt('quarantine.learn_spam_delete'), destructive: true },
  { id: 'delete', label: lt('quarantine.remove'), destructive: true },
])
function toggleAll(checked: boolean) {
  if (checked) selection.selectPage(pageIds.value)
  else clearSelection()
}
function toggleSelecting() {
  if (selection.active.value) selection.leave()
  else selection.enter()
}
function runBulk(id: string) {
  if (!canRemove.value || busy.value) return
  void bulk.run(id as ItemActionKind)
}

function finish(lines: OutcomeLine[]) {
  flash.value = lines
  selected.value = undefined
}
async function reread(): Promise<RereadResult> {
  if (!selected.value) return 'gone'
  try {
    selected.value = await client.fetchQuery({
      ...quarantineItemOptions(selected.value.id),
      staleTime: 0,
    })
    await query.refetch()
    return 'present'
  } catch (error) {
    return isApiProblem(error) && error.status === 404 ? 'gone' : 'failed'
  }
}
const action = useItemAction({
  item: () => selected.value,
  reread,
  onFinished: finish,
  onGone(lines) {
    if (selected.value) void forgetItem(client, selected.value.id)
    finish(lines)
  },
})
const busy = computed(
  () => asking.value || action.sending.value || action.waiting.value || bulk.busy.value,
)
async function remove(item: QuarantineItem) {
  if (!canRemove.value || busy.value) return
  asking.value = true
  selected.value = item
  flash.value = []
  try {
    await action.run('delete')
  } finally {
    asking.value = false
  }
}
function clearAll() {
  void list.setFilters({ ...NO_FILTERS, action: [] })
}
function announceCount() {
  if (!query.data.value) return
  const start = total.value === 0 ? 0 : (state.value.page - 1) * state.value.size + 1
  announce(
    total.value === 0
      ? lt('datatables.infoEmpty')
      : lt('datatables.info', {
          _START_: fmt.number(start),
          _END_: fmt.number(Math.min(total.value, state.value.page * state.value.size)),
          _TOTAL_: fmt.number(total.value),
        }),
  )
}
watch(() => query.dataUpdatedAt.value, announceCount)
// Includes browser back/forward, which bypasses useListState's setters.
watch(() => JSON.stringify(list.params.value), clearSelection)
watch([total, () => state.value.page, () => query.isSuccess.value], ([count, page, success]) => {
  const last = Math.max(1, Math.ceil(count / state.value.size))
  if (success && page > last) void list.setPage(last)
})
async function refresh() {
  await query.refetch()
  announceCount()
}
</script>

<template>
  <section class="mx-auto flex min-h-dvh w-full max-w-7xl min-w-0 flex-col gap-4">
    <QuarantineSectionNav />
    <PageHeader :title="lt('quarantine.quarantine')">
      <template #actions>
        <button
          v-if="canRemove"
          type="button"
          data-select-mode
          :disabled="busy || !capabilities.data.value"
          :aria-pressed="selection.active.value"
          :class="buttonVariants({ variant: 'outline' })"
          @click="toggleSelecting"
        >
          {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
        </button>
        <span
          v-if="query.data.value"
          class="self-center tabular-nums text-gray-800 dark:text-gray-200"
          >{{ fmt.number(total) }}</span
        >
        <button
          type="button"
          :disabled="query.isFetching.value || busy"
          :class="buttonVariants({ variant: 'outline' })"
          @click="refresh"
        >
          {{ lt('quarantine.refresh') }}
        </button>
      </template>
    </PageHeader>
    <ProblemMessage
      v-if="settings.isError.value"
      :problem="problemOf(settings.error.value)"
      retry
      @retry="settings.refetch()"
    />
    <QuarantineStatusNotice :settings="settings.data.value ?? null" />
    <ProblemMessage
      v-if="capabilities.isError.value"
      :problem="problemOf(capabilities.error.value)"
      retry
      @retry="capabilities.refetch()"
    />
    <AclReadOnlyNote v-if="!canRemove && aclFlag" id="quarantine-actions-acl" :flag="aclFlag" />
    <ActionOutcomeMessage :lines="flash" @dismiss="flash = []" />
    <ActionOutcomeMessage :lines="action.lines.value" @dismiss="action.dismiss" />
    <button
      v-if="action.retryKind.value"
      type="button"
      :disabled="busy"
      :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
      @click="action.retry"
    >
      {{ t('common.retry') }}
    </button>
    <SearchField
      id="quarantine-search"
      :label="lt('datatables.search')"
      :model-value="state.filters.q ?? ''"
      @search="list.setFilter('q', $event || undefined, { typing: true })"
    />
    <QuarantineFilters
      :filters="state.filters"
      :scoped="scoped"
      :domains="scopeDomains"
      @apply="list.setFilters"
    />
    <QuarantineSortControl
      v-if="!wide"
      :sort="state.sort ?? 'arrivedAt'"
      :order="state.order ?? 'desc'"
      @change="list.setSort"
    />
    <p v-if="bulk.phase.value === 'running'" role="status">
      {{ t('bulk.progress', { count: bulk.running.value }) }}
    </p>
    <BulkResultSummary
      v-if="bulk.phase.value === 'results' && bulk.rows.value.length > 0"
      data-bulk-results
      :rows="bulk.rows.value"
      @retry="bulk.retry"
      @close="bulk.close"
      @refresh="refresh"
    >
      <template #item="{ row }">
        <QuarantineBulkResultRow :item="bulk.itemFor(row.id)" :lines="bulk.linesFor(row.id)" />
      </template>
    </BulkResultSummary>
    <ProblemMessage v-if="bulk.problem.value" :problem="bulk.problem.value" />
    <p
      v-if="query.isError.value && query.data.value"
      role="alert"
      class="text-amber-900 dark:text-amber-100"
    >
      {{ t('lists.refreshFailed') }}
    </p>
    <ListState
      :loading="query.isPending.value"
      :empty="items.length === 0"
      :problem="query.data.value ? null : problemOf(query.error.value)"
      @retry="query.refetch()"
    >
      <template #empty>
        <div
          v-if="list.hasSearchOrFilters.value"
          data-no-matches
          class="flex flex-col items-start gap-3"
        >
          <p>{{ lt('datatables.zeroRecords') }}</p>
          <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clearAll">
            {{ t('lists.filters.clear') }}
          </button>
        </div>
        <p v-else data-empty>{{ lt('datatables.emptyTable') }}</p>
      </template>
      <div
        v-if="selection.active.value && canRemove"
        data-select-all
        class="flex items-center gap-2"
      >
        <SelectCheckbox
          :label="t('bulk.selectAll')"
          :checked="allSelected"
          :disabled="busy"
          @change="toggleAll"
        />
        <span aria-hidden="true">{{ t('bulk.selectAll') }}</span>
      </div>
      <QuarantineItemList
        :items="items"
        :scoped="scoped"
        :sort="state.sort ?? 'arrivedAt'"
        :order="state.order ?? 'desc'"
        :can-remove="canRemove"
        :busy="busy"
        :selectable="selection.active.value && canRemove"
        @sort="list.setSort"
        @remove="remove"
      >
        <template #select="{ item }">
          <SelectCheckbox
            :label="t('bulk.selectItem', { name: item.id })"
            :checked="selection.isSelected(String(item.id))"
            :disabled="busy || !selection.canSelect(String(item.id))"
            :described-by="limitMessage ? 'quarantine-bulk-limit' : undefined"
            @change="selection.toggle(String(item.id))"
          />
        </template>
      </QuarantineItemList>
    </ListState>
    <PaginationBar
      v-if="query.data.value"
      :total="total"
      :page="state.page"
      :size="state.size"
      :page-sizes="list.pageSizes"
      @update:page="list.setPage"
      @update:size="list.setSize($event as PageSize)"
    />
    <BulkActionBar
      v-if="selection.active.value && canRemove"
      :count="selection.count.value"
      :actions="bulkActions"
      :busy="busy"
      :limit-message="limitMessage"
      limit-id="quarantine-bulk-limit"
      @action="runBulk"
      @clear="clearSelection"
    />
  </section>
</template>

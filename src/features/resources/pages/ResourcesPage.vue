<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import { useDataList } from '@/shared/composables/useDataList'

// The resource list (US7, FR-042, FR-043), the classic "Resources" tab
// (`mailbox/tab-resources.twig`, `draw_resource_table()`): legacy's title, "Add resource", refresh,
// the booking legend, the server's search, the domain, kind and active filters and the sort in the
// address, cards below md and a table from md up, the list states with DataTables' texts, the entry
// menu with Edit and Remove (deletion only here, as in legacy), legacy's outcome alerts, and
// selection mode with activate, deactivate and delete (US6-AS3, research R16).
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf, type Resource } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import {
  BulkConfirmContent,
  CapabilitiesGate,
  feature004Permissions,
  useAliasesCapabilities,
  useBulkRun,
} from '@/features/aliases-common'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import { useProblemMessages } from '@/i18n/problems'
import type { AppLocale } from '@/i18n/locales'
import ActiveFilterChips from '@/shared/components/ActiveFilterChips.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import type { BulkRow } from '@/shared/components/bulk-row'
import type { DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import type { FilterChip } from '@/shared/components/filter-chip'
import OutcomeAlert from '@/shared/components/OutcomeAlert.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import type { PageSize } from '@/shared/composables/useListState'
import { useFilteredListAnnouncement } from '@/shared/composables/useFilteredListAnnouncement'
import { useListQueryState } from '@/shared/composables/useListQueryState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { applyResourceBulkAction, resourceListOptions } from '../api'
import BookingLegend from '../components/BookingLegend.vue'
import ResourceEntryActions from '../components/ResourceEntryActions.vue'
import ResourceFilters from '../components/ResourceFilters.vue'
import ResourceList from '../components/ResourceList.vue'

import { useResourceDeletion, type ResourceOutcome } from '../composables/useResourceDeletion'
import { takeResourceListFlash } from '../flash'
import { toResourceParams, useResourceListState, type ResourceListFilters } from '../list-state'
import { resourceBulkActions, type ResourceBulkAction } from '../resource-bulk'

const { t, locale } = useI18n()
const { problemMessage } = useProblemMessages()
const wide = useMediaQuery('(min-width: 768px)')
const identity = useIdentityQuery()
const capabilities = useAliasesCapabilities()
const permissions = computed(() =>
  feature004Permissions(identity.data.value, capabilities.data.value),
)

/** Legacy's alert for the last outcome: a deletion, or a resource that vanished. */
const outcome = ref<(ResourceOutcome & { id: number }) | null>(null)
let outcomes = 0
function report(next: ResourceOutcome) {
  outcomes += 1
  outcome.value = { ...next, id: outcomes }
}
const flashed = takeResourceListFlash()
if (flashed) report(flashed)
const deletion = useResourceDeletion(report)

const selection = useBulkSelection({ limit: () => capabilities.data.value?.bulkLimit })
const list = useResourceListState({ onReset: () => selection.clear() })
const state = computed(() => list.state.value)
const params = computed(() => toResourceParams(state.value))
const query = useQuery(
  computed(() => ({ ...resourceListOptions(params.value), placeholderData: keepPreviousData })),
)
const items = computed(() => query.data.value?.data ?? [])
const { total, initialLoading, loadFailed, refreshFailed, empty, noMatches, listState } =
  useListQueryState(query, list.hasSearchOrFilters)
useFilteredListAnnouncement(query, state)

const labels = ref<Record<string, string>>({})
function remember(option: DomainPickerOption) {
  labels.value = { ...labels.value, [option.name]: option.nameUnicode }
}

function updateFilters(change: Partial<ResourceListFilters>) {
  void list.setFilters(change)
}
const NO_FILTERS: Partial<ResourceListFilters> = {
  q: undefined,
  domain: [],
  kind: [],
  active: undefined,
}
const filterCount = computed(() => list.activeFilters.value.filter((key) => key !== 'q').length)

const chips = computed<(FilterChip & { change: Partial<ResourceListFilters> })[]>(() => {
  const filters = state.value.filters
  const result: (FilterChip & { change: Partial<ResourceListFilters> })[] = []
  for (const value of filters.domain) {
    result.push({
      key: `domain-${value}`,
      label: `${lt('mailbox.domain')}: ${labels.value[value] ?? value}`,
      change: { domain: filters.domain.filter((item) => item !== value) },
    })
  }
  for (const value of filters.kind) {
    result.push({
      key: `kind-${value}`,
      label: `${lt('mailbox.kind')}: ${t(`enums.resourceKind.${value}`)}`,
      change: { kind: filters.kind.filter((item) => item !== value) },
    })
  }
  if (filters.active !== undefined) {
    result.push({
      key: 'active',
      label: `${lt('mailbox.active')}: ${filters.active === 'true' ? t('lists.filters.yes') : t('lists.filters.no')}`,
      change: { active: undefined },
    })
  }
  return result
})
function removeChip(key: string) {
  const chip = chips.value.find((item) => item.key === key)
  if (chip) updateFilters(chip.change)
}

const number = (value: number) => formatNumber(value, locale.value as AppLocale)

function refresh() {
  void query.refetch()
}

// Mass actions (FR-056 to FR-060, research R16).
const actions = resourceBulkActions()
const barActions = actions.map((item) => ({
  id: item.action,
  label: lt(item.labelKey),
  destructive: item.destructive,
}))

function ask(action: ResourceBulkAction, selected: readonly Resource[]) {
  const config = actions.find((item) => item.action === action)
  if (!config || config.confirm === 'none') return Promise.resolve(true)
  const names = selected.map((item) => `${item.description} (${item.addressUnicode})`)
  if (config.confirm === 'simple') {
    return confirm({
      title: lt(config.labelKey),
      description: t('resources.bulk.confirm.deactivate', { count: number(selected.length) }),
      content: { component: BulkConfirmContent, props: { names, lines: [] } },
      confirmLabel: lt(config.labelKey),
      cancelLabel: lt('footer.cancel'),
      destructive: true,
    })
  }
  return confirm({
    title: lt('footer.confirm_delete'),
    description: lt('footer.delete_these_items'),
    content: {
      component: BulkConfirmContent,
      props: {
        names,
        lines: [t('resources.bulk.deleteImpact')],
      },
    },
    confirmLabel: lt('footer.delete_now'),
    cancelLabel: lt('footer.cancel'),
    destructive: true,
    requireTyped: {
      accepted: [String(selected.length)],
      labelKey: 'bulk.confirm.typeCount',
      labelParams: { count: selected.length },
    },
  })
}

const queryClient = useQueryClient()
const bulk = useBulkRun({
  selection,
  entries: () => items.value,
  idOf: (item) => item.address,
  labelOf: (item) => item.address,
  ask,
  send: (action, targets) => applyResourceBulkAction(queryClient, { action, targets }),
  refreshList: () => query.refetch(),
})

/** Each result line says the single action's legacy message (FR-059). */
function bulkMessage(row: BulkRow): string | null {
  if (row.outcome === 'done') {
    return bulk.action.value === 'delete'
      ? lt('success.resource_removed', row.label)
      : lt('success.resource_modified', row.label)
  }
  return row.problem ? problemMessage(row.problem, { params: { address: row.label } }) : null
}

const pageIds = computed(() => items.value.map((item) => item.address))
const allSelected = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selection.isSelected(id) || !selection.canSelect(id)),
)
function toggleAll(checked: boolean) {
  if (checked) selection.selectPage(pageIds.value)
  else selection.clear()
}
const limitMessage = computed(() =>
  selection.limitReached.value && selection.limit.value !== null
    ? t('bulk.limitReached', { max: number(selection.limit.value) })
    : null,
)
function toggleSelecting() {
  if (selection.active.value) selection.leave()
  else selection.enter()
}

useDataList('resources-pages-resources', undefined, () => ({
  run: refresh,
  pending: query.isFetching.value,
  disabled: false,
}))
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <PageHeader :title="lt('mailbox.resources')">
      <template #actions>
        <RouterLink
          v-if="permissions.canManageResources"
          :to="{ name: 'resource-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_resource') }}
        </RouterLink>
      </template>
    </PageHeader>

    <OutcomeAlert
      v-if="outcome"
      :key="outcome.id"
      :kind="outcome.kind"
      :message="outcome.message"
      @dismiss="outcome = null"
    />

    <BookingLegend />

    <ListToolbar
      ><template #select
        ><button
          v-if="permissions.canManageResources"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :aria-pressed="selection.active.value ? 'true' : 'false'"
          @click="toggleSelecting"
        >
          {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
        </button></template
      ><template #filters
        ><ResourceFilters
          :filters="state.filters"
          :active-count="filterCount"
          :labels="labels"
          @pick="remember"
          @update="updateFilters"
          @clear="updateFilters({ ...NO_FILTERS, q: state.filters.q })" /></template
      ><template #search
        ><SearchField
          id="resource-search"
          :label="lt('datatables.search')"
          :model-value="state.filters.q ?? ''"
          @search="
            (value) => list.setFilter('q', value || undefined, { typing: true })
          " /></template
    ></ListToolbar>

    <ActiveFilterChips
      :chips="chips"
      @remove="removeChip"
      @clear="updateFilters({ ...NO_FILTERS, q: state.filters.q })"
    />

    <ListState
      :loading="initialLoading"
      :failed="loadFailed"
      :problem="problemOf(query.error.value)"
      :empty="empty"
      :no-matches="noMatches"
      :skeleton="28"
      empty-layout="actions"
      :refresh-failed="refreshFailed"
      :refresh-text="t('lists.refreshFailed')"
      :no-matches-attrs="{ 'data-empty': 'noMatch' }"
      :empty-attrs="{ 'data-empty': 'none' }"
      :clear-label="t('lists.filters.clear')"
      @clear="updateFilters(NO_FILTERS)"
      @retry="refresh"
    >
      <template #before-content>
        <div
          v-if="bulk.phase.value === 'running'"
          data-bulk-progress
          role="status"
          class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
        >
          <SyncIcon class="size-5 motion-safe:animate-spin" />
          {{ t('bulk.progress', { count: number(bulk.running.value) }) }}
        </div>
        <BulkResultSummary
          v-else-if="bulk.phase.value === 'results' && bulk.rows.value.length > 0"
          data-bulk-summary
          :rows="bulk.rows.value"
          :message="bulkMessage"
          @retry="bulk.retry"
          @refresh="bulk.refresh"
          @close="bulk.close"
        />
        <ProblemMessage v-if="bulk.problem.value" :problem="bulk.problem.value" />
      </template>
      <template #empty-actions>
        <RouterLink
          v-if="permissions.canManageResources"
          :to="{ name: 'resource-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_resource') }}
        </RouterLink>
      </template>
      <template #default>
        <div v-if="selection.active.value && !wide" class="flex items-center gap-2">
          <SelectCheckbox
            :label="lt('mailbox.toggle_all')"
            :checked="allSelected"
            described-by="bulk-limit-message"
            @change="toggleAll"
          />
          <span aria-hidden="true" class="text-sm text-gray-700 dark:text-gray-300">{{
            lt('mailbox.toggle_all')
          }}</span>
        </div>
        <ResourceList
          :selectable="selection.active.value"
          :resources="items"
          :sort="state.sort ?? 'description'"
          :order="state.order ?? 'asc'"
          @sort="(sort, order) => list.setSort(sort, order)"
        >
          <template v-if="permissions.canManageResources" #actions="{ resource }">
            <ResourceEntryActions :resource="resource" @delete="deletion.start" />
          </template>
          <template #select-all>
            <SelectCheckbox
              :label="lt('mailbox.toggle_all')"
              :checked="allSelected"
              @change="toggleAll"
            />
          </template>
          <template #select="{ resource }">
            <SelectCheckbox
              :label="t('bulk.selectItem', { name: resource.addressUnicode })"
              :checked="selection.isSelected(resource.address)"
              :disabled="!selection.canSelect(resource.address)"
              described-by="bulk-limit-message"
              @change="selection.toggle(resource.address)"
            />
          </template>
        </ResourceList>
        <PaginationBar
          :total="total"
          :page="state.page"
          :size="state.size"
          :page-sizes="list.pageSizes"
          @update:page="list.setPage"
          @update:size="(size) => list.setSize(size as PageSize)"
        />
      </template>
    </ListState>

    <CapabilitiesGate v-if="selection.active.value">
      <BulkActionBar
        :count="selection.count.value"
        :actions="barActions"
        :limit-message="limitMessage"
        :busy="bulk.phase.value === 'running'"
        @action="(id) => bulk.run(id as ResourceBulkAction)"
        @clear="selection.clear()"
      />
    </CapabilitiesGate>
  </section>
</template>

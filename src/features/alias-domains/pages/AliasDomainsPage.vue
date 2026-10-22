<script setup lang="ts">
// The domain alias list (US4, FR-033, FR-034), the classic "Domain aliases" tab
// (`mailbox/tab-domain-aliases.twig`, `draw_aliasdomain_table()`): legacy's title, "Add domain
// alias" only with `aliasDomains` (hidden otherwise, as legacy's `data-acl`), refresh, the server's
// search, the target and active filters and the sort in the address, cards below md and a table
// from md up, the list states with DataTables' texts, the entry menu with Edit and Remove
// (deletion only here, as in legacy), legacy's outcome alerts, and selection mode with activate,
// deactivate and delete (US6, research R16; no flag needed, US6-AS7).
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf, type AliasDomain } from '@/api'
import { isEntryAvailable } from '@/app/navigation/visibility'
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

import { aliasDomainBulkActions, type AliasDomainBulkAction } from '../alias-domain-bulk'
import { aliasDomainListOptions, applyAliasDomainBulkAction } from '../api'
import AliasDomainEntryActions from '../components/AliasDomainEntryActions.vue'
import AliasDomainFilters from '../components/AliasDomainFilters.vue'
import AliasDomainList from '../components/AliasDomainList.vue'
import AliasDomainSortControl from '../components/AliasDomainSortControl.vue'
import {
  useAliasDomainDeletion,
  type AliasDomainOutcome,
} from '../composables/useAliasDomainDeletion'
import { takeAliasDomainListFlash } from '../flash'
import {
  toAliasDomainParams,
  useAliasDomainListState,
  type AliasDomainListFilters,
} from '../list-state'

const { t, locale } = useI18n()
const { problemMessage } = useProblemMessages()
const wide = useMediaQuery('(min-width: 768px)')
const identity = useIdentityQuery()
const capabilities = useAliasesCapabilities()
const permissions = computed(() =>
  feature004Permissions(identity.data.value, capabilities.data.value),
)
const linkDomains = computed(() => isEntryAvailable('domains', identity.data.value))

/** Legacy's alert for the last outcome: a deletion, or an alias domain that vanished. */
const outcome = ref<(AliasDomainOutcome & { id: number }) | null>(null)
let outcomes = 0
function report(next: AliasDomainOutcome) {
  outcomes += 1
  outcome.value = { ...next, id: outcomes }
}
const flashed = takeAliasDomainListFlash()
if (flashed) report(flashed)
const deletion = useAliasDomainDeletion(report)

const selection = useBulkSelection({ limit: () => capabilities.data.value?.bulkLimit })
const list = useAliasDomainListState({ onReset: () => selection.clear() })
const state = computed(() => list.state.value)
const params = computed(() => toAliasDomainParams(state.value))
const query = useQuery(
  computed(() => ({ ...aliasDomainListOptions(params.value), placeholderData: keepPreviousData })),
)
const items = computed(() => query.data.value?.data ?? [])
const { total, initialLoading, loadFailed, refreshFailed, empty, noMatches, listState } =
  useListQueryState(query, list.hasSearchOrFilters)
useFilteredListAnnouncement(query, state)

const labels = ref<Record<string, string>>({})
function remember(option: DomainPickerOption) {
  labels.value = { ...labels.value, [option.name]: option.nameUnicode }
}

function updateFilters(change: Partial<AliasDomainListFilters>) {
  void list.setFilters(change)
}
const NO_FILTERS: Partial<AliasDomainListFilters> = {
  q: undefined,
  targetDomain: [],
  active: undefined,
}
const filterCount = computed(() => list.activeFilters.value.filter((key) => key !== 'q').length)

const chips = computed<(FilterChip & { change: Partial<AliasDomainListFilters> })[]>(() => {
  const filters = state.value.filters
  const result: (FilterChip & { change: Partial<AliasDomainListFilters> })[] = []
  for (const value of filters.targetDomain) {
    result.push({
      key: `target-${value}`,
      label: `${lt('mailbox.target_domain')}: ${labels.value[value] ?? value}`,
      change: { targetDomain: filters.targetDomain.filter((item) => item !== value) },
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
const actions = aliasDomainBulkActions()
const barActions = actions.map((item) => ({
  id: item.action,
  label: lt(item.labelKey),
  destructive: item.destructive,
}))

function ask(action: AliasDomainBulkAction, selected: readonly AliasDomain[]) {
  const config = actions.find((item) => item.action === action)
  if (!config || config.confirm === 'none') return Promise.resolve(true)
  const names = selected.map((item) => item.nameUnicode)
  if (config.confirm === 'simple') {
    return confirm({
      title: lt(config.labelKey),
      description: t('aliasDomains.bulk.confirm.deactivate', { count: number(selected.length) }),
      content: { component: BulkConfirmContent, props: { names, lines: [] } },
      confirmLabel: lt(config.labelKey),
      cancelLabel: lt('footer.cancel'),
      destructive: true,
    })
  }
  const aliasCount = selected.reduce((sum, item) => sum + item.aliasCount, 0)
  return confirm({
    title: lt('footer.confirm_delete'),
    description: lt('footer.delete_these_items'),
    content: {
      component: BulkConfirmContent,
      props: {
        names,
        lines: [t('aliasDomains.bulk.deleteImpact', { count: number(aliasCount) })],
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
  idOf: (item) => item.name,
  labelOf: (item) => item.name,
  ask,
  send: (action, targets) => applyAliasDomainBulkAction(queryClient, { action, targets }),
  refreshList: () => query.refetch(),
})

/** Each result line says the single action's legacy message (FR-059). */
function bulkMessage(row: BulkRow): string | null {
  if (row.outcome === 'done') {
    return bulk.action.value === 'delete'
      ? lt('success.alias_domain_removed', row.label)
      : lt('success.aliasd_modified', row.label)
  }
  return row.problem ? problemMessage(row.problem, { params: { name: row.label } }) : null
}

const pageIds = computed(() => items.value.map((item) => item.name))
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
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <PageHeader :title="lt('mailbox.domain_aliases')">
      <template #actions>
        <RouterLink
          v-if="permissions.canAddAliasDomain"
          :to="{ name: 'alias-domain-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_domain_alias') }}
        </RouterLink>
        <button
          v-if="permissions.canManageAliasDomains"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :aria-pressed="selection.active.value ? 'true' : 'false'"
          @click="toggleSelecting"
        >
          {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
        </button>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="refresh">
          <SyncIcon :class="query.isFetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>

    <OutcomeAlert
      v-if="outcome"
      :key="outcome.id"
      :kind="outcome.kind"
      :message="outcome.message"
      @dismiss="outcome = null"
    />

    <SearchField
      id="alias-domain-search"
      :label="lt('datatables.search')"
      :model-value="state.filters.q ?? ''"
      @search="(value) => list.setFilter('q', value || undefined, { typing: true })"
    />
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <AliasDomainFilters
        class="md:flex-1"
        :filters="state.filters"
        :active-count="filterCount"
        :labels="labels"
        @pick="remember"
        @update="updateFilters"
        @clear="updateFilters({ ...NO_FILTERS, q: state.filters.q })"
      />
      <AliasDomainSortControl
        v-if="!wide"
        :sort="state.sort ?? 'name'"
        :order="state.order ?? 'asc'"
        @change="(sort, order) => list.setSort(sort, order)"
      />
    </div>
    <ActiveFilterChips
      :chips="chips"
      @remove="removeChip"
      @clear="updateFilters({ ...NO_FILTERS, q: state.filters.q })"
    />

    <div
      v-if="initialLoading"
      data-list-loading
      role="status"
      aria-busy="true"
      class="flex flex-col gap-3"
    >
      <span class="sr-only">{{ lt('datatables.loadingRecords') }}</span>
      <div
        v-for="index in 3"
        :key="index"
        aria-hidden="true"
        class="h-28 rounded-2xl border border-gray-200 bg-gray-100 motion-safe:animate-pulse dark:border-gray-800 dark:bg-gray-900"
      />
    </div>

    <div v-else-if="loadFailed" class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('states.list.error') }}
      </p>
      <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="refresh" />
    </div>

    <template v-else>
      <p
        v-if="refreshFailed"
        role="alert"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        {{ t('lists.refreshFailed') }}
      </p>

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

      <div v-if="noMatches" data-empty="noMatch" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.zeroRecords') }}</p>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="updateFilters(NO_FILTERS)"
        >
          {{ t('lists.filters.clear') }}
        </button>
      </div>

      <div v-else-if="empty" data-empty="none" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.emptyTable') }}</p>
        <RouterLink
          v-if="permissions.canAddAliasDomain"
          :to="{ name: 'alias-domain-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_domain_alias') }}
        </RouterLink>
      </div>

      <template v-else>
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
        <AliasDomainList
          :selectable="selection.active.value"
          :alias-domains="items"
          :sort="state.sort ?? 'name'"
          :order="state.order ?? 'asc'"
          :link-domains="linkDomains"
          @sort="(sort, order) => list.setSort(sort, order)"
        >
          <template v-if="permissions.canManageAliasDomains" #actions="{ aliasDomain }">
            <AliasDomainEntryActions :alias-domain="aliasDomain" @delete="deletion.start" />
          </template>
          <template #select-all>
            <SelectCheckbox
              :label="lt('mailbox.toggle_all')"
              :checked="allSelected"
              @change="toggleAll"
            />
          </template>
          <template #select="{ aliasDomain }">
            <SelectCheckbox
              :label="t('bulk.selectItem', { name: aliasDomain.nameUnicode })"
              :checked="selection.isSelected(aliasDomain.name)"
              :disabled="!selection.canSelect(aliasDomain.name)"
              described-by="bulk-limit-message"
              @change="selection.toggle(aliasDomain.name)"
            />
          </template>
        </AliasDomainList>
        <PaginationBar
          :total="total"
          :page="state.page"
          :size="state.size"
          :page-sizes="list.pageSizes"
          @update:page="list.setPage"
          @update:size="(size) => list.setSize(size as PageSize)"
        />
      </template>
    </template>

    <CapabilitiesGate v-if="selection.active.value">
      <BulkActionBar
        :count="selection.count.value"
        :actions="barActions"
        :limit-message="limitMessage"
        :busy="bulk.phase.value === 'running'"
        @action="(id) => bulk.run(id as AliasDomainBulkAction)"
        @clear="selection.clear()"
      />
    </CapabilitiesGate>
  </section>
</template>

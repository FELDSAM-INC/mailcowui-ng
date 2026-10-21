<script setup lang="ts">
// The alias list (US1, FR-005 to FR-017), the classic "Aliases" tab (`mailbox/tab-mbox-aliases.twig`,
// `draw_alias_table()`): legacy's title, refresh and hint, the server's search, filters and sort in
// the address, cards below md and a table from md up, the list states and DataTables' texts, and the
// result count announced after a search or filter change. The groupware elements appear once the
// capabilities say the groupware is enabled; the list never waits for them (research R5). "Add
// alias" (US2), the entry menu with Edit, "Expand alias over alias domains" and Remove (US3, US6;
// only here, as in legacy), legacy's outcome alerts, and selection mode with the mass actions
// (US6, research R16): "Toggle all" for the page up to the bulk limit, the bar inside the
// capabilities gate, the confirmations, one result per alias and the copies of each alias.
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf, type AliasCopyReport } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import { useProblemMessages } from '@/i18n/problems'
import type { AppLocale } from '@/i18n/locales'
import ActiveFilterChips from '@/shared/components/ActiveFilterChips.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import type { BulkRow } from '@/shared/components/bulk-row'
import type { FilterChip } from '@/shared/components/filter-chip'
import type { DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import OutcomeAlert from '@/shared/components/OutcomeAlert.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import type { PageSize } from '@/shared/composables/useListState'
import { CloseIcon, PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import {
  BulkConfirmContent,
  CapabilitiesGate,
  feature004Permissions,
  useAliasesCapabilities,
  useBulkRun,
} from '@/features/aliases-common'

import { aliasBulkActions, type AliasBulkAction } from '../alias-bulk'
import { aliasListOptions, applyAliasBulkAction } from '../api'
import AliasEntryActions from '../components/AliasEntryActions.vue'
import CopyResults from '../components/CopyResults.vue'
import AliasFilters from '../components/AliasFilters.vue'
import AliasList from '../components/AliasList.vue'
import AliasSortControl from '../components/AliasSortControl.vue'
import { useAliasCopy } from '../composables/useAliasCopy'
import { useAliasDeletion, type AliasOutcome } from '../composables/useAliasDeletion'
import { takeAliasListFlash } from '../flash'
import { toAliasParams, useAliasListState, type AliasListFilters } from '../list-state'

const { t, locale } = useI18n()
const { problemMessage } = useProblemMessages()
const wide = useMediaQuery('(min-width: 768px)')
const identity = useIdentityQuery()
const capabilities = useAliasesCapabilities()
const groupwareEnabled = computed(() => capabilities.data.value?.groupwareEnabled)
const permissions = computed(() =>
  feature004Permissions(identity.data.value, capabilities.data.value),
)

/** Legacy's alert for the last outcome: a deletion, or an alias that vanished (FR-028, FR-030). */
const outcome = ref<(AliasOutcome & { id: number }) | null>(null)
let outcomes = 0
function report(next: AliasOutcome) {
  outcomes += 1
  outcome.value = { ...next, id: outcomes }
}
const flashed = takeAliasListFlash()
if (flashed) report(flashed)
const deletion = useAliasDeletion(report)
/** The copies of the last single "Expand alias over alias domains" (FR-032). */
const copyReport = ref<AliasCopyReport | null>(null)
const copy = useAliasCopy({
  report,
  copied: (result) => {
    outcome.value = null
    copyReport.value = result
  },
})

const selection = useBulkSelection({ limit: () => capabilities.data.value?.bulkLimit })
const list = useAliasListState({ onReset: () => selection.clear() })
const state = computed(() => list.state.value)
const params = computed(() =>
  toAliasParams(state.value, { groupwareEnabled: groupwareEnabled.value }),
)
const query = useQuery(
  computed(() => ({ ...aliasListOptions(params.value), placeholderData: keepPreviousData })),
)
const aliases = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)

/** Readable names of the domains picked in the filters, for their chips. */
const labels = ref<Record<string, string>>({})
function remember(option: DomainPickerOption) {
  labels.value = { ...labels.value, [option.name]: option.nameUnicode }
}

function updateFilters(change: Partial<AliasListFilters>) {
  void list.setFilters(change)
}

const NO_FILTERS: Partial<AliasListFilters> = {
  q: undefined,
  domain: [],
  primaryDomain: [],
  kind: [],
  destinationType: [],
  destination: undefined,
  active: undefined,
  senderAllowed: undefined,
  groupwareVisible: undefined,
  internal: undefined,
}
const filterCount = computed(() => list.activeFilters.value.filter((key) => key !== 'q').length)

const chips = computed<(FilterChip & { change: Partial<AliasListFilters> })[]>(() => {
  const filters = state.value.filters
  const result: (FilterChip & { change: Partial<AliasListFilters> })[] = []
  const name = (value: string) => labels.value[value] ?? value
  for (const value of filters.domain) {
    result.push({
      key: `domain-${value}`,
      label: `${lt('mailbox.domain')}: ${name(value)}`,
      change: { domain: filters.domain.filter((item) => item !== value) },
    })
  }
  for (const value of filters.primaryDomain) {
    result.push({
      key: `primary-${value}`,
      label: `${lt('mailbox.target_domain')}: ${name(value)}`,
      change: { primaryDomain: filters.primaryDomain.filter((item) => item !== value) },
    })
  }
  if (filters.destination) {
    result.push({
      key: 'destination',
      label: `${lt('mailbox.target_address')}: ${name(filters.destination)}`,
      change: { destination: undefined },
    })
  }
  return result
})
const enumChips = computed(() => {
  const filters = state.value.filters
  return [
    ...filters.kind.map((value) => ({
      key: `kind-${value}`,
      messageKey: `enums.aliasKind.${value}`,
      change: { kind: filters.kind.filter((item) => item !== value) },
    })),
    ...filters.destinationType.map((value) => ({
      key: `type-${value}`,
      messageKey: `enums.aliasDestinationType.${value}`,
      change: { destinationType: filters.destinationType.filter((item) => item !== value) },
    })),
  ]
})
const flagChips = computed(() => {
  const filters = state.value.filters
  const flags = [
    ['active', 'mailbox.active'],
    ['senderAllowed', 'edit.sender_allowed'],
    ['groupwareVisible', 'mailbox.sogo_visible'],
    ['internal', 'mailbox.internal'],
  ] as const
  return flags
    .filter(
      ([key]) =>
        filters[key] !== undefined && (key !== 'groupwareVisible' || groupwareEnabled.value),
    )
    .map(([key, label]) => ({
      key,
      label: `${lt(label)}: ${filters[key] === 'true' ? t('lists.filters.yes') : t('lists.filters.no')}`,
      change: { [key]: undefined },
    }))
})
const allChips = computed(() => [...chips.value, ...enumChips.value, ...flagChips.value])
function removeChip(key: string) {
  const chip = allChips.value.find((item) => item.key === key)
  if (chip) updateFilters(chip.change)
}

// FR-010: the result count is announced after a search or filter change, without moving focus.
const filterKey = computed(() => JSON.stringify(state.value.filters))
let announcedFor = filterKey.value
const number = (value: number) => formatNumber(value, locale.value as AppLocale)
watch(
  () => [query.data.value, query.isPlaceholderData.value] as const,
  ([data, placeholder]) => {
    if (!data || placeholder || filterKey.value === announcedFor) return
    announcedFor = filterKey.value
    const from = data.meta.total === 0 ? 0 : (state.value.page - 1) * state.value.size + 1
    announce(
      data.meta.total === 0
        ? lt('datatables.infoEmpty')
        : lt('datatables.info', {
            _START_: number(from),
            _END_: number(Math.min(data.meta.total, state.value.page * state.value.size)),
            _TOTAL_: number(data.meta.total),
          }),
    )
  },
)

const initialLoading = computed(() => query.isPending.value)
const loadFailed = computed(() => query.isError.value && !query.data.value)
const refreshFailed = computed(() => query.isError.value && !!query.data.value)
const empty = computed(
  () => !!query.data.value && !query.isPlaceholderData.value && total.value === 0,
)
const noMatches = computed(() => empty.value && list.hasSearchOrFilters.value)
const listState = computed(() =>
  initialLoading.value ? 'loading' : loadFailed.value ? 'error' : empty.value ? 'empty' : 'ready',
)

function refresh() {
  void query.refetch()
}

// Mass actions (FR-056 to FR-060, research R16).
const actions = computed(() =>
  aliasBulkActions(permissions.value, { groupwareEnabled: groupwareEnabled.value }),
)
const barActions = computed(() =>
  actions.value.map((item) => ({
    id: item.action,
    label: lt(item.labelKey),
    destructive: item.destructive,
  })),
)

function ask(action: AliasBulkAction, selected: readonly { address: string }[]) {
  const config = actions.value.find((item) => item.action === action)
  if (!config || config.confirm === 'none') return Promise.resolve(true)
  const names = selected.map((alias) => alias.address)
  const count = number(selected.length)
  if (config.confirm === 'simple') {
    return confirm({
      title: lt(config.labelKey),
      description: t(
        action === 'deactivate' ? 'aliases.bulk.confirm.deactivate' : 'aliases.bulk.confirm.hide',
        { count },
      ),
      content: { component: BulkConfirmContent, props: { names, lines: [] } },
      confirmLabel: lt(config.labelKey),
      cancelLabel: lt('footer.cancel'),
      destructive: true,
    })
  }
  if (config.confirm === 'explain') {
    return confirm({
      title: lt('mailbox.add_alias_expand'),
      description: t('aliases.copy.explain'),
      content: { component: BulkConfirmContent, props: { names, lines: [] } },
      confirmLabel: lt('mailbox.add_alias_expand'),
      cancelLabel: lt('footer.cancel'),
    })
  }
  return confirm({
    title: lt('footer.confirm_delete'),
    description: lt('footer.delete_these_items'),
    content: {
      component: BulkConfirmContent,
      props: { names, lines: [t('aliases.bulk.deleteImpact')] },
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
  entries: () => aliases.value,
  idOf: (alias) => String(alias.id),
  labelOf: (alias) => alias.address,
  ask,
  send: (action, targets) => applyAliasBulkAction(queryClient, { action, targets }),
  refreshList: () => query.refetch(),
})

/** Each result line says the single action's legacy message (FR-059). */
function bulkMessage(row: BulkRow): string | null {
  if (row.outcome === 'done') {
    if (bulk.action.value === 'copyOverAliasDomains') return null
    return bulk.action.value === 'delete'
      ? lt('success.alias_removed', row.label)
      : lt('success.alias_modified', row.label)
  }
  return row.problem ? problemMessage(row.problem, { params: { address: row.label } }) : null
}

const pageIds = computed(() => aliases.value.map((alias) => String(alias.id)))
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
    <PageHeader :title="lt('mailbox.aliases')">
      <template #actions>
        <RouterLink
          v-if="permissions.canManageAliases"
          :to="{ name: 'alias-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_alias') }}
        </RouterLink>
        <button
          v-if="permissions.canManageAliases"
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
    <section
      v-if="copyReport"
      :aria-label="lt('mailbox.add_alias_expand')"
      class="flex items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <h2 class="text-sm font-semibold break-all text-gray-900 dark:text-white">
          {{ lt('mailbox.add_alias_expand') }}: {{ copyReport.address }}
        </h2>
        <CopyResults :copies="copyReport.copies" />
      </div>
      <button
        type="button"
        class="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-white/10"
        :aria-label="t('common.close')"
        @click="copyReport = null"
      >
        <CloseIcon class="size-5" />
      </button>
    </section>

    <LegacyText
      k="mailbox.alias_domain_alias_hint"
      as="p"
      class="text-gray-700 dark:text-gray-300"
    />

    <SearchField
      id="alias-search"
      :label="lt('datatables.search')"
      :model-value="state.filters.q ?? ''"
      @search="(value) => list.setFilter('q', value || undefined, { typing: true })"
    />
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <AliasFilters
        class="md:flex-1"
        :filters="state.filters"
        :active-count="filterCount"
        :groupware-enabled="groupwareEnabled"
        :labels="labels"
        @pick="remember"
        @update="updateFilters"
        @clear="updateFilters({ ...NO_FILTERS, q: state.filters.q })"
      />
      <AliasSortControl
        :sort="state.sort ?? 'id'"
        :order="state.order ?? 'desc'"
        :groupware-enabled="groupwareEnabled"
        @change="(sort, order) => list.setSort(sort, order)"
      />
    </div>
    <ActiveFilterChips
      :chips="allChips"
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
        class="h-40 rounded-2xl border border-gray-200 bg-gray-100 motion-safe:animate-pulse dark:border-gray-800 dark:bg-gray-900"
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
      >
        <template #item="{ row }">
          <CopyResults
            v-if="
              bulk.action.value === 'copyOverAliasDomains' &&
              row.outcome === 'done' &&
              bulk.extra.value?.[row.id]
            "
            :copies="bulk.extra.value[row.id]!"
          />
        </template>
      </BulkResultSummary>
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
          v-if="permissions.canManageAliases"
          :to="{ name: 'alias-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_alias') }}
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
        <AliasList
          :selectable="selection.active.value"
          :aliases="aliases"
          :sort="state.sort ?? 'id'"
          :order="state.order ?? 'desc'"
          :groupware-enabled="groupwareEnabled"
          :can-see-orphaned="permissions.canSeeOrphaned"
          @sort="(sort, order) => list.setSort(sort, order)"
        >
          <template v-if="permissions.canManageAliases" #actions="{ alias }">
            <AliasEntryActions :alias="alias" @delete="deletion.start" @copy="copy.start" />
          </template>
          <template #select-all>
            <SelectCheckbox
              :label="lt('mailbox.toggle_all')"
              :checked="allSelected"
              @change="toggleAll"
            />
          </template>
          <template #select="{ alias }">
            <SelectCheckbox
              :label="t('bulk.selectItem', { name: alias.addressUnicode })"
              :checked="selection.isSelected(String(alias.id))"
              :disabled="!selection.canSelect(String(alias.id))"
              described-by="bulk-limit-message"
              @change="selection.toggle(String(alias.id))"
            />
          </template>
        </AliasList>
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
        @action="(id) => bulk.run(id as AliasBulkAction)"
        @clear="selection.clear()"
      />
    </CapabilitiesGate>
  </section>
</template>

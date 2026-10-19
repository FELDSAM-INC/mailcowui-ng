<script setup lang="ts">
// The domain alias list (US4, FR-033, FR-034), the classic "Domain aliases" tab
// (`mailbox/tab-domain-aliases.twig`, `draw_aliasdomain_table()`): legacy's title, "Add domain
// alias" only with `aliasDomains` (hidden otherwise, as legacy's `data-acl`), refresh, the server's
// search, the target and active filters and the sort in the address, cards below md and a table
// from md up, the list states with DataTables' texts, the entry menu with Edit and Remove
// (deletion only here, as in legacy) and legacy's outcome alerts. Selection mode comes with US6.
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf } from '@/api'
import { isEntryAvailable } from '@/app/navigation/visibility'
import { useIdentityQuery } from '@/app/session/queries'
import { feature004Permissions, useAliasesCapabilities } from '@/features/aliases'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import ActiveFilterChips from '@/shared/components/ActiveFilterChips.vue'
import type { DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import type { FilterChip } from '@/shared/components/filter-chip'
import OutcomeAlert from '@/shared/components/OutcomeAlert.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import type { PageSize } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { aliasDomainListOptions } from '../api'
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

const list = useAliasDomainListState()
const state = computed(() => list.state.value)
const params = computed(() => toAliasDomainParams(state.value))
const query = useQuery(
  computed(() => ({ ...aliasDomainListOptions(params.value), placeholderData: keepPreviousData })),
)
const items = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)

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
        <AliasDomainList
          :alias-domains="items"
          :sort="state.sort ?? 'name'"
          :order="state.order ?? 'asc'"
          :link-domains="linkDomains"
          @sort="(sort, order) => list.setSort(sort, order)"
        >
          <template v-if="permissions.canManageAliasDomains" #actions="{ aliasDomain }">
            <AliasDomainEntryActions :alias-domain="aliasDomain" @delete="deletion.start" />
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
  </section>
</template>

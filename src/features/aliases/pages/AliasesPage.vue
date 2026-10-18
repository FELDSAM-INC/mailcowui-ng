<script setup lang="ts">
// The alias list (US1, FR-005 to FR-017), the classic "Aliases" tab (`mailbox/tab-mbox-aliases.twig`,
// `draw_alias_table()`): legacy's title, refresh and hint, the server's search, filters and sort in
// the address, cards below md and a table from md up, the list states and DataTables' texts, and the
// result count announced after a search or filter change. The groupware elements appear once the
// capabilities say the groupware is enabled; the list never waits for them (research R5). Later
// stories add "Add alias" (US2), the entry actions (US3) and selection mode (US6).
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import ActiveFilterChips from '@/shared/components/ActiveFilterChips.vue'
import type { FilterChip } from '@/shared/components/filter-chip'
import type { DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import type { PageSize } from '@/shared/composables/useListState'
import { SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { aliasListOptions } from '../api'
import { useAliasesCapabilities } from '../capabilities'
import AliasFilters from '../components/AliasFilters.vue'
import AliasList from '../components/AliasList.vue'
import AliasSortControl from '../components/AliasSortControl.vue'
import { toAliasParams, useAliasListState, type AliasListFilters } from '../list-state'
import { feature004Permissions } from '../permissions'

const { t, locale } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const identity = useIdentityQuery()
const capabilities = useAliasesCapabilities()
const groupwareEnabled = computed(() => capabilities.data.value?.groupwareEnabled)
const permissions = computed(() =>
  feature004Permissions(identity.data.value, capabilities.data.value),
)

const list = useAliasListState()
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
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <PageHeader :title="lt('mailbox.aliases')">
      <template #actions>
        <slot name="header-actions" />
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="refresh">
          <SyncIcon :class="query.isFetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>

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
        v-if="!wide"
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
      <slot name="before-list" />

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
        <slot name="empty-actions" />
      </div>

      <template v-else>
        <AliasList
          :aliases="aliases"
          :sort="state.sort ?? 'id'"
          :order="state.order ?? 'desc'"
          :groupware-enabled="groupwareEnabled"
          :can-see-orphaned="permissions.canSeeOrphaned"
          @sort="(sort, order) => list.setSort(sort, order)"
        />
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

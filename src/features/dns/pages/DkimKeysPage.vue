<script setup lang="ts">
// The ARC/DKIM keys (US1, FR-005 to FR-015; legacy `admin/tab-config-dkim.twig`): every DKIM entry
// in scope with the classic state toggles as filters, kind, completeness, selector and domain
// filters, search, sort, pages and page size in the address; cards below md and a table from md up;
// the four list states; a refresh that keeps the results when it fails; the result count announced
// after a search or filter change; and the server settings for administrators.
import { useQuery } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { useDnsCapabilities } from '../api/capabilities'
import { dkimListOptions } from '../api/dkim'
import DkimEntryList from '../components/DkimEntryList.vue'
import DkimFilters from '../components/DkimFilters.vue'
import DkimSettingsSummary from '../components/DkimSettingsSummary.vue'
import DkimSortControl from '../components/DkimSortControl.vue'
import { useDnsRole } from '../composables/useDnsRole'
import { useDkimListState, type DkimListFilters } from '../dkim/list-state'

const { t, locale } = useI18n()
const { role } = useDnsRole()
const capabilities = useDnsCapabilities()
const list = useDkimListState(role.value)
const state = computed(() => list.state.value)

const query = useQuery(computed(() => dkimListOptions(list.params.value)))
const entries = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const countText = computed(() =>
  t('dns.dkim.list.count', { count: formatNumber(total.value, locale.value as AppLocale) }),
)

function updateFilters(change: Partial<DkimListFilters>) {
  void list.setFilters(change)
}
function clearFilters() {
  void list.setFilters({
    state: [],
    kind: undefined,
    complete: undefined,
    selector: undefined,
    domain: undefined,
  })
}
function clearAll() {
  void list.setFilters({
    q: undefined,
    state: [],
    kind: undefined,
    complete: undefined,
    selector: undefined,
    domain: undefined,
  })
}

// FR-008: the result count is announced after a search or filter change, without moving focus.
const filterKey = computed(() => JSON.stringify(state.value.filters))
let announcedFor = filterKey.value
watch(
  () => [query.data.value, query.isPlaceholderData.value] as const,
  ([data, placeholder]) => {
    if (!data || placeholder || filterKey.value === announcedFor) return
    announcedFor = filterKey.value
    announce(countText.value)
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
    <PageHeader :title="lt('admin.dkim_keys')">
      <template #actions>
        <slot name="header-actions" />
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="refresh">
          <SyncIcon :class="query.isFetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>

    <DkimSettingsSummary
      v-if="role === 'admin' && capabilities.data.value"
      :caps="capabilities.data.value"
    />

    <div class="flex flex-col gap-3">
      <SearchField
        id="dkim-search"
        :label="lt('datatables.search')"
        :model-value="state.filters.q ?? ''"
        @search="(value) => list.setFilter('q', value || undefined, { typing: true })"
      />
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <DkimFilters
          class="md:flex-1"
          :role="role"
          :states="state.filters.state"
          :kind="state.filters.kind"
          :complete="state.filters.complete"
          :selector="state.filters.selector"
          :domain="state.filters.domain"
          :active-count="list.activeFilterCount.value"
          @update="updateFilters"
          @clear="clearFilters"
        />
        <DkimSortControl
          class="md:hidden"
          :sort="state.sort ?? 'name'"
          :order="state.order ?? 'asc'"
          @change="(sort, order) => list.setSort(sort, order)"
        />
      </div>
    </div>

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
        class="h-32 rounded-2xl border border-gray-200 bg-gray-100 motion-safe:animate-pulse dark:border-gray-800 dark:bg-gray-900"
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
        {{ t('dns.dkim.list.refreshFailed') }}
      </p>

      <slot name="results" />

      <div v-if="noMatches" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.zeroRecords') }}</p>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clearAll">
          {{ t('lists.chips.clearAll') }}
        </button>
      </div>

      <div v-else-if="empty" data-dkim-empty class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.emptyTable') }}</p>
        <RouterLink :to="{ name: 'domains' }" :class="buttonVariants({ variant: 'outline' })">
          {{ lt('mailbox.domains') }}
        </RouterLink>
      </div>

      <template v-else>
        <p data-result-count class="text-sm text-gray-700 dark:text-gray-300">
          {{ countText }}
          <span v-if="query.isPlaceholderData.value" class="ms-2 text-gray-600 dark:text-gray-400">
            {{ t('dns.dkim.list.updating') }}
          </span>
        </p>
        <DkimEntryList
          :entries="entries"
          :sort="state.sort ?? 'name'"
          :order="state.order ?? 'asc'"
          @sort="(sort, order) => list.setSort(sort, order)"
          @filter-selector="(selector) => list.setFilter('selector', selector)"
        />
        <PaginationBar
          :total="total"
          :page="state.page"
          :size="state.size"
          :page-sizes="list.pageSizes"
          @update:page="list.setPage"
          @update:size="(size) => list.setSize(size as 25 | 50 | 100)"
        />
      </template>
    </template>
  </section>
</template>

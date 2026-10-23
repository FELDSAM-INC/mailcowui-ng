<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import { useDataList } from '@/shared/composables/useDataList'

// The MTA-STS policies (US4, FR-054 to FR-056; no classic counterpart, so its own texts are new
// strings and its fields use the classic MTA-STS tab's labels): every policy in scope with search,
// active and mode filters, sort, pages and page size in the address; cards below md and a table from
// md up; opening an entry opens the domain page at its MTA-STS section; the four list states; a
// refresh that keeps the results when it fails; the result count announced after a change.
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useListQueryState } from '@/shared/composables/useListQueryState'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf } from '@/api'
import { useFilteredListAnnouncement } from '@/shared/composables/useFilteredListAnnouncement'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { mtaStsListOptions } from '../api/mta-sts'
import MtaStsFilters from '../components/MtaStsFilters.vue'
import MtaStsPolicyCard from '../components/MtaStsPolicyCard.vue'
import MtaStsPolicyTable from '../components/MtaStsPolicyTable.vue'

import { useMtaStsListState, type MtaStsListFilters } from '../mta-sts/list-state'

const { t, locale } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const list = useMtaStsListState()
const state = computed(() => list.state.value)

const query = useQuery(computed(() => mtaStsListOptions(list.params.value)))
const policies = computed(() => query.data.value?.data ?? [])
const { total, initialLoading, loadFailed, refreshFailed, empty, noMatches, listState } =
  useListQueryState(query, () => list.hasSearchOrFilters.value)
const countText = computed(() =>
  t('dns.mtaSts.list.count', { count: formatNumber(total.value, locale.value as AppLocale) }),
)

function updateFilters(change: Partial<MtaStsListFilters>) {
  void list.setFilters(change)
}
function clearAll() {
  void list.setFilters({ q: undefined, active: undefined, mode: undefined })
}

useFilteredListAnnouncement(query, state, () => countText.value)

function refresh() {
  void query.refetch()
}

useDataList('dns-pages-mtastspolicies')
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <PageHeader :title="lt('edit.mta_sts')">
      <template #actions>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="refresh">
          <SyncIcon :class="query.isFetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>

    <div class="flex flex-col gap-3">
      <ListToolbar
        ><template #filters
          ><MtaStsFilters
            :active="state.filters.active"
            :mode="state.filters.mode"
            :active-count="list.activeFilterCount.value"
            @update="updateFilters"
            @clear="updateFilters({ active: undefined, mode: undefined })" /></template
        ><template #search
          ><SearchField
            id="mta-sts-search"
            :label="lt('datatables.search')"
            :model-value="state.filters.q ?? ''"
            @search="
              (value) => list.setFilter('q', value || undefined, { typing: true })
            " /></template
      ></ListToolbar>
    </div>

    <ListState
      :loading="initialLoading"
      :failed="loadFailed"
      :problem="problemOf(query.error.value)"
      :empty="empty"
      :no-matches="noMatches"
      :skeleton="32"
      empty-layout="actions"
      :empty-text="t('dns.mtaSts.list.empty')"
      :refresh-failed="refreshFailed"
      :refresh-text="t('dns.dkim.list.refreshFailed')"
      :empty-attrs="{ 'data-mta-sts-empty': '' }"
      :clear-label="t('lists.chips.clearAll')"
      @clear="clearAll"
      @retry="refresh"
    >
      <template #empty-actions>
        <RouterLink :to="{ name: 'domains' }" :class="buttonVariants({ variant: 'outline' })">
          {{ lt('mailbox.domains') }}
        </RouterLink>
      </template>
      <template #default>
        <p data-result-count class="text-sm text-gray-700 dark:text-gray-300">
          {{ countText }}
          <span v-if="query.isPlaceholderData.value" class="ms-2 text-gray-600 dark:text-gray-400">
            {{ t('dns.dkim.list.updating') }}
          </span>
        </p>
        <MtaStsPolicyTable
          :hidden="!wide"
          :policies="policies"
          :sort="state.sort ?? 'domain'"
          :order="state.order ?? 'asc'"
          @sort="(sort, order) => list.setSort(sort, order)"
        />
        <ul v-if="!wide" :aria-label="lt('edit.mta_sts')" class="flex flex-col gap-3">
          <MtaStsPolicyCard v-for="policy in policies" :key="policy.domain" :policy="policy" />
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
  </section>
</template>

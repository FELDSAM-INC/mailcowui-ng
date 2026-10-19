<script setup lang="ts">
// The MTA-STS policies (US4, FR-054 to FR-056; no classic counterpart, so its own texts are new
// strings and its fields use the classic MTA-STS tab's labels): every policy in scope with search,
// active and mode filters, sort, pages and page size in the address; cards below md and a table from
// md up; opening an entry opens the domain page at its MTA-STS section; the four list states; a
// refresh that keeps the results when it fails; the result count announced after a change.
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
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { mtaStsListOptions } from '../api/mta-sts'
import MtaStsFilters from '../components/MtaStsFilters.vue'
import MtaStsPolicyCard from '../components/MtaStsPolicyCard.vue'
import MtaStsPolicyTable from '../components/MtaStsPolicyTable.vue'
import MtaStsSortControl from '../components/MtaStsSortControl.vue'
import { useMtaStsListState, type MtaStsListFilters } from '../mta-sts/list-state'

const { t, locale } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const list = useMtaStsListState()
const state = computed(() => list.state.value)

const query = useQuery(computed(() => mtaStsListOptions(list.params.value)))
const policies = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const countText = computed(() =>
  t('dns.mtaSts.list.count', { count: formatNumber(total.value, locale.value as AppLocale) }),
)

function updateFilters(change: Partial<MtaStsListFilters>) {
  void list.setFilters(change)
}
function clearAll() {
  void list.setFilters({ q: undefined, active: undefined, mode: undefined })
}

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
    <PageHeader :title="lt('edit.mta_sts')">
      <template #actions>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="refresh">
          <SyncIcon :class="query.isFetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>

    <div class="flex flex-col gap-3">
      <SearchField
        id="mta-sts-search"
        :label="lt('datatables.search')"
        :model-value="state.filters.q ?? ''"
        @search="(value) => list.setFilter('q', value || undefined, { typing: true })"
      />
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <MtaStsFilters
          class="md:flex-1"
          :active="state.filters.active"
          :mode="state.filters.mode"
          :active-count="list.activeFilterCount.value"
          @update="updateFilters"
          @clear="updateFilters({ active: undefined, mode: undefined })"
        />
        <MtaStsSortControl
          class="md:hidden"
          :sort="state.sort ?? 'domain'"
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

      <div v-if="noMatches" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.zeroRecords') }}</p>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clearAll">
          {{ t('lists.chips.clearAll') }}
        </button>
      </div>

      <div v-else-if="empty" data-mta-sts-empty class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ t('dns.mtaSts.list.empty') }}</p>
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
        <MtaStsPolicyTable
          v-if="wide"
          :policies="policies"
          :sort="state.sort ?? 'domain'"
          :order="state.order ?? 'asc'"
          @sort="(sort, order) => list.setSort(sort, order)"
        />
        <ul v-else :aria-label="lt('edit.mta_sts')" class="flex flex-col gap-3">
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
    </template>
  </section>
</template>

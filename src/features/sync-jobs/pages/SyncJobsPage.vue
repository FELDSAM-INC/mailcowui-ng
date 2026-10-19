<script setup lang="ts">
// The sync job list (UI 008 US1, FR-005 to FR-014), mirroring the classic "Sync jobs" tab of the
// mailbox page (administrators, domain administrators) and of the user page (mailbox users): search,
// filters, sort, page and size in the address; cards below md and a table from md up; the list
// states with the classic DataTables texts; a manual refresh and the automatic refresh while a
// listed job runs; the match count announced after a search or filter change. Later stories add the
// create action (US2), selection mode (US4), the log viewer (US5) and deletion (US6).
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf, type SyncJob } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { useSessionStore } from '@/app/session/store'
import { legacy, lt, resolveText, text, type TextRef } from '@/i18n'
import { useFormat } from '@/i18n/format'
import ActiveFilterChips, { type FilterChip } from '@/shared/components/ActiveFilterChips.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { syncJobListOptions } from '../api'
import AutoRefreshControl from '../components/AutoRefreshControl.vue'
import SyncJobFilters from '../components/SyncJobFilters.vue'
import SyncJobList from '../components/SyncJobList.vue'
import SyncJobRowActions from '../components/SyncJobRowActions.vue'
import { useRunningRefresh } from '../composables/useRunningRefresh'
import { useSyncJobListState, type SyncJobListFilters } from '../list-state'
import { listTexts } from '../presentation'

const { t } = useI18n()
const fmt = useFormat()
const identity = useIdentityQuery()
const session = useSessionStore()
const role = identity.data.value?.role ?? 'mailboxUser'
const texts = listTexts(role)
const wide = useMediaQuery('(min-width: 768px)')
const list = useSyncJobListState(role)
const state = computed(() => list.state.value)
const selecting = ref(false)
// The current page's jobs, for the automatic refresh (the query is created after it).
const pageJobs = shallowRef<readonly SyncJob[]>([])

const refresh = useRunningRefresh({
  jobs: () => pageJobs.value,
  selecting: () => selecting.value,
  refetch: () => query.refetch(),
  dataUpdatedAt: () => query.dataUpdatedAt.value,
  idleTimeout: () => session.idleTimeout,
  inactivityNotice: () => t('syncJobs.refresh.inactive'),
})

const query = useQuery(
  computed(() => ({
    ...syncJobListOptions(list.params.value),
    placeholderData: keepPreviousData,
    refetchInterval: refresh.interval.value,
    refetchIntervalInBackground: false,
  })),
)
const jobs = computed(() => query.data.value?.data ?? [])
watch(jobs, (value) => (pageJobs.value = value), { immediate: true })
const total = computed(() => query.data.value?.meta.total ?? 0)
const countText = computed(() => t('syncJobs.list.count', { count: fmt.number(total.value) }))

function onSearch(q: string) {
  void list.setFilter('q', q || undefined, { typing: true })
}

const NO_FILTERS: Partial<SyncJobListFilters> = {
  mailbox: undefined,
  domain: undefined,
  active: undefined,
  running: undefined,
  result: undefined,
}
function clearAll() {
  void list.setFilters({ q: undefined, ...NO_FILTERS })
}

// The active filters as removable chips (shared `ActiveFilterChips`).
const label = (ref: TextRef) => resolveText(ref, t)
const chips = computed<FilterChip[]>(() => {
  const { mailbox, domain, active, running, result } = state.value.filters
  const chip = (
    key: keyof SyncJobListFilters & string,
    filter: TextRef,
    value: string,
  ): FilterChip => ({
    key,
    label: t('syncJobs.filters.chip', { filter: label(filter), value }),
  })
  return [
    ...(mailbox ? [chip('mailbox', texts.owner, mailbox)] : []),
    ...(domain ? [chip('domain', legacy('mailbox.domain'), domain)] : []),
    ...(active
      ? [chip('active', texts.active, lt(active === 'yes' ? 'mailbox.active' : 'mailbox.inactive'))]
      : []),
    ...(running
      ? [chip('running', texts.status, label(running === 'yes' ? texts.running : texts.waiting))]
      : []),
    ...(result
      ? [
          chip(
            'result',
            texts.result,
            text(`enums.syncJobLastResult.${result === 'none' ? 'unknown' : result}`),
          ),
        ]
      : []),
  ]
})

// FR-009: the match count is announced after a search or filter change, without moving focus.
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

function reload() {
  refresh.noteManualRefresh()
  void query.refetch()
}

/** "Create new sync job", with the list's owner filter as the preselected owner. */
const createLocation = computed(() => ({
  name: 'sync-job-create',
  query: state.value.filters.mailbox ? { mailbox: state.value.filters.mailbox } : {},
}))

function openLog(id: number) {
  void list.setView('log', id)
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <PageHeader :title="resolveText(texts.title, t)">
      <template #actions>
        <RouterLink :to="createLocation" :class="buttonVariants({ variant: 'default' })">
          <PlusIcon />
          {{ lt('user.create_syncjob') }}
        </RouterLink>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="reload">
          <SyncIcon :class="query.isFetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>

    <div class="flex flex-col gap-3">
      <SearchField
        id="sync-job-search"
        :label="lt('datatables.search')"
        :model-value="state.filters.q ?? ''"
        @search="onSearch"
      />
      <SyncJobFilters
        :role="role"
        :filters="state.filters"
        :active-count="list.activeFilterCount.value"
        :sort="state.sort ?? 'id'"
        :order="state.order ?? 'desc'"
        :show-sort="!wide"
        @update="(change) => list.setFilters(change)"
        @clear="list.setFilters(NO_FILTERS)"
        @sort="(sort, order) => list.setSort(sort, order)"
      />
      <ActiveFilterChips
        :chips="chips"
        @remove="(key) => list.setFilter(key as keyof SyncJobListFilters & string, undefined)"
        @clear="list.setFilters(NO_FILTERS)"
      />
    </div>

    <AutoRefreshControl
      :visible="refresh.hasRunning.value && !selecting"
      :paused="refresh.paused.value"
      :inactive="refresh.inactive.value"
      @pause="refresh.pause()"
      @resume="refresh.resume()"
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
        class="h-32 rounded-2xl border border-gray-200 bg-gray-100 motion-safe:animate-pulse dark:border-gray-800 dark:bg-gray-900"
      />
    </div>

    <div v-else-if="loadFailed" class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('states.list.error') }}
      </p>
      <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="reload" />
    </div>

    <template v-else>
      <p
        v-if="refreshFailed"
        role="alert"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        {{ t('syncJobs.list.refreshFailed') }}
      </p>

      <div v-if="noMatches" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.zeroRecords') }}</p>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clearAll">
          {{ t('syncJobs.list.clearAll') }}
        </button>
      </div>

      <div v-else-if="empty" data-empty class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.emptyTable') }}</p>
        <RouterLink :to="createLocation" :class="buttonVariants({ variant: 'default' })">
          <PlusIcon />
          {{ lt('user.create_syncjob') }}
        </RouterLink>
      </div>

      <template v-else>
        <p data-result-count class="text-sm text-gray-700 dark:text-gray-300">
          {{ countText }}
        </p>
        <SyncJobList
          :jobs="jobs"
          :role="role"
          :sort="state.sort ?? 'id'"
          :order="state.order ?? 'desc'"
          @sort="(sort, order) => list.setSort(sort, order)"
          @open-log="(job) => openLog(job.id)"
        >
          <template #actions="{ job }">
            <SyncJobRowActions :job="job" :role="role" />
          </template>
        </SyncJobList>
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

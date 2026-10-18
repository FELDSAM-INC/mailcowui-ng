<script setup lang="ts">
// The domain list (UI 002 US1, FR-005 to FR-014): search, filters, sort, pages and page size in
// the address; cards below md and a table from md up; the four list states; a refresh that keeps
// the results when it fails; and the result count announced after a search or filter change.
// Later stories add "Add domain" (US2), the entry actions (US4), selection (US5) and the link to
// the templates for administrators (US6).
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { CloseIcon, LayersIcon, PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

import { domainListOptions, problemOf } from '../api'
import { useDomainCapabilities } from '../capabilities'
import DomainEntryActions from '../components/list/DomainEntryActions.vue'
import DomainFilters from '../components/list/DomainFilters.vue'
import DomainList from '../components/list/DomainList.vue'
import DomainSortControl from '../components/list/DomainSortControl.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { useDomainBulk, type DomainBulkAction } from '../composables/useDomainBulk'
import { useDomainDeletion } from '../composables/useDomainDeletion'
import { useDomainPermissions } from '../composables/useDomainPermissions'
import { useDomainFormat } from '../format'
import { useDomainListState, type DomainListFilters } from '../list-state'

const SEARCH_DEBOUNCE_MS = 300

const { t } = useI18n()
const format = useDomainFormat()
const wideList = useMediaQuery('(min-width: 768px)')
const { permissions } = useDomainPermissions()
const capabilities = useDomainCapabilities()
const selection = useBulkSelection({ limit: () => capabilities.data.value?.bulkLimit })
const list = useDomainListState({ onReset: () => selection.clear() })
const deletion = useDomainDeletion()
const state = computed(() => list.state.value)

const query = useQuery(
  computed(() => ({ ...domainListOptions(list.params.value), placeholderData: keepPreviousData })),
)
const domains = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const countText = computed(() => t('domains.list.count', { count: format.count(total.value) }))

// Search: typing is debounced and written with router.replace (UI 001 R20).
const search = ref(state.value.filters.q ?? '')
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => state.value.filters.q,
  (q) => {
    if ((q ?? '') !== search.value.trim()) search.value = q ?? ''
  },
)
function onSearch(event: Event) {
  search.value = (event.target as HTMLInputElement).value
  clearTimeout(timer)
  timer = setTimeout(() => {
    void list.setFilter('q', search.value.trim() || undefined, { typing: true })
  }, SEARCH_DEBOUNCE_MS)
}
function clearSearch() {
  clearTimeout(timer)
  search.value = ''
  void list.setFilter('q', undefined)
}
onBeforeUnmount(() => clearTimeout(timer))

function updateFilters(change: Partial<DomainListFilters>) {
  void list.setFilters(change)
}
function clearAll() {
  clearTimeout(timer)
  search.value = ''
  void list.setFilters({ q: undefined, active: undefined, relay: undefined, tag: [] })
}
function filterByTag(tag: string) {
  const tags = state.value.filters.tag
  if (!tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
    void list.setFilter('tag', [...tags, tag])
  }
}

// FR-073: the result count is announced after a search or filter change, without moving focus.
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

// Bulk actions (FR-045 to FR-048, research D22).
const bulk = useDomainBulk({ selection, entries: () => domains.value })
const pageIds = computed(() => domains.value.map((domain) => domain.name))
const limitMessage = computed(() =>
  selection.limitReached.value && selection.limit.value !== null
    ? t('bulk.limitReached', { max: format.count(selection.limit.value) })
    : null,
)
const allSelected = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selection.isSelected(id) || !selection.canSelect(id)),
)
const BULK_ACTIONS = computed(() => [
  { id: 'activate', label: lt('mailbox.activate') },
  { id: 'deactivate', label: lt('mailbox.deactivate') },
  { id: 'delete', label: lt('mailbox.remove'), destructive: true },
])
function toggleAll(checked: boolean) {
  if (checked) selection.selectPage(pageIds.value)
  else selection.clear()
}
function toggleSelecting() {
  if (selection.active.value) selection.leave()
  else selection.enter()
}
useLeaveGuard(() => bulk.phase.value === 'running', {
  titleKey: 'domains.bulk.leaveTitle',
  messageKey: 'domains.bulk.leaveRunning',
})
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <PageHeader :title="lt('mailbox.domains')">
      <template #actions>
        <RouterLink
          v-if="permissions.canCreate"
          :to="{ name: 'domain-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_domain') }}
        </RouterLink>
        <RouterLink
          v-if="permissions.canManageTemplates"
          :to="{ name: 'domain-templates' }"
          :class="buttonVariants({ variant: 'outline' })"
        >
          <LayersIcon />
          {{ lt('mailbox.domain_templates') }}
        </RouterLink>
        <button
          v-if="permissions.canBulk"
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

    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="domain-search" class="text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ lt('datatables.search') }}
        </label>
        <div class="flex gap-2">
          <input
            id="domain-search"
            type="search"
            :value="search"
            :maxlength="SEARCH_MAX_LENGTH"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            @input="onSearch"
          />
          <button
            v-if="search !== ''"
            type="button"
            :class="buttonVariants({ variant: 'outline', size: 'icon' })"
            :aria-label="t('lists.search.clear')"
            @click="clearSearch"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <DomainFilters
          class="md:flex-1"
          :active="state.filters.active"
          :relay="state.filters.relay"
          :tags="state.filters.tag"
          :active-count="list.activeFilterCount.value"
          @update="updateFilters"
          @clear="updateFilters({ active: undefined, relay: undefined, tag: [] })"
        />
        <DomainSortControl
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
        {{ t('domains.bulk.progress', { count: bulk.running.value }) }}
      </div>
      <BulkResultSummary
        v-else-if="bulk.phase.value === 'results' && bulk.rows.value.length > 0"
        :rows="bulk.rows.value"
        @retry="bulk.retry"
        @close="bulk.close"
      />
      <ProblemMessage v-if="bulk.problem.value" :problem="bulk.problem.value" />

      <div v-if="noMatches" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.zeroRecords') }}</p>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clearAll">
          {{ t('domains.empty.clearAll') }}
        </button>
      </div>

      <div v-else-if="empty" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">
          {{ lt('datatables.emptyTable') }}
        </p>
        <RouterLink
          v-if="permissions.canCreate"
          :to="{ name: 'domain-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_domain') }}
        </RouterLink>
      </div>

      <template v-else>
        <p data-result-count class="text-sm text-gray-700 dark:text-gray-300">
          {{ countText }}
          <span v-if="query.isPlaceholderData.value" class="ms-2 text-gray-600 dark:text-gray-400">
            {{ t('lists.updating') }}
          </span>
        </p>
        <div v-if="selection.active.value && !wideList" class="flex items-center gap-2">
          <SelectCheckbox :label="t('bulk.selectAll')" :checked="allSelected" @change="toggleAll" />
          <span aria-hidden="true" class="text-sm text-gray-700 dark:text-gray-300">{{
            t('bulk.selectAll')
          }}</span>
        </div>
        <DomainList
          :selectable="selection.active.value"
          :domains="domains"
          :sort="state.sort ?? 'name'"
          :order="state.order ?? 'asc'"
          :can-see-domain-admins="permissions.canSeeDomainAdmins"
          @sort="(sort, order) => list.setSort(sort, order)"
          @filter-tag="filterByTag"
        >
          <template v-if="permissions.canDelete" #actions="{ domain }">
            <DomainEntryActions :domain="domain" @delete="deletion.start" />
          </template>
          <template #select-all>
            <SelectCheckbox
              :label="t('bulk.selectAll')"
              :checked="allSelected"
              @change="toggleAll"
            />
          </template>
          <template #select="{ domain }">
            <SelectCheckbox
              :label="t('bulk.selectItem', { name: domain.unicodeName })"
              :checked="selection.isSelected(domain.name)"
              :disabled="!selection.canSelect(domain.name)"
              described-by="bulk-limit-message"
              @change="selection.toggle(domain.name)"
            />
          </template>
        </DomainList>
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

    <BulkActionBar
      v-if="selection.active.value"
      :count="selection.count.value"
      :actions="BULK_ACTIONS"
      :limit-message="limitMessage"
      :busy="bulk.phase.value === 'running'"
      @action="(id) => bulk.run(id as DomainBulkAction)"
      @clear="selection.clear()"
    />
  </section>
</template>

<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useDataList } from '@/shared/composables/useDataList'

// The domain list (UI 002 US1, FR-005 to FR-014): search, filters, sort, pages and page size in
// the address; cards below md and a table from md up; the four list states; a refresh that keeps
// the results when it fails; and the result count announced after a search or filter change.
// Later stories add "Add domain" (US2), the entry actions (US4), selection (US5) and the link to
// the templates for administrators (US6).
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useListQueryState } from '@/shared/composables/useListQueryState'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useFilteredListAnnouncement } from '@/shared/composables/useFilteredListAnnouncement'
import { lt } from '@/i18n'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { domainListOptions, problemOf } from '../api'
import { useDomainCapabilities } from '../capabilities'
import DomainEntryActions from '../components/list/DomainEntryActions.vue'
import DomainFilters from '../components/list/DomainFilters.vue'
import DomainList from '../components/list/DomainList.vue'

import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { useDomainBulk, type DomainBulkAction } from '../composables/useDomainBulk'
import { useDomainDeletion } from '../composables/useDomainDeletion'
import { useDomainPermissions } from '../composables/useDomainPermissions'
import { useDomainFormat } from '../format'
import { useDomainListState, type DomainListFilters } from '../list-state'

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
const { total, initialLoading, loadFailed, refreshFailed, empty, noMatches, listState } =
  useListQueryState(query, () => list.hasSearchOrFilters.value)
const countText = computed(() => t('domains.list.count', { count: format.count(total.value) }))

function updateFilters(change: Partial<DomainListFilters>) {
  void list.setFilters(change)
}
function clearAll() {
  void list.setFilters({ q: undefined, active: undefined, relay: undefined, tag: [] })
}
function filterByTag(tag: string) {
  const tags = state.value.filters.tag
  if (!tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
    void list.setFilter('tag', [...tags, tag])
  }
}

// FR-073: the result count is announced after a search or filter change, without moving focus.
useFilteredListAnnouncement(query, state, () => countText.value)

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

useDataList('domains-pages-domainlistpage', undefined, () => ({
  run: refresh,
  pending: query.isFetching.value,
  disabled: false,
}))
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
      </template>
    </PageHeader>

    <div class="flex flex-col gap-3">
      <ListToolbar
        ><template #select
          ><button
            v-if="permissions.canBulk"
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :aria-pressed="selection.active.value ? 'true' : 'false'"
            @click="toggleSelecting"
          >
            {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
          </button></template
        ><template #filters
          ><DomainFilters
            :active="state.filters.active"
            :relay="state.filters.relay"
            :tags="state.filters.tag"
            :active-count="list.activeFilterCount.value"
            @update="updateFilters"
            @clear="updateFilters({ active: undefined, relay: undefined, tag: [] })" /></template
        ><template #search
          ><SearchField
            id="domain-search"
            :label="lt('datatables.search')"
            :model-value="state.filters.q ?? ''"
            :delay="300"
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
      :skeleton="40"
      empty-layout="actions"
      :refresh-failed="refreshFailed"
      :refresh-text="t('lists.refreshFailed')"
      :clear-label="t('domains.empty.clearAll')"
      @clear="clearAll"
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
          {{ t('domains.bulk.progress', { count: bulk.running.value }) }}
        </div>
        <BulkResultSummary
          v-else-if="bulk.phase.value === 'results' && bulk.rows.value.length > 0"
          :rows="bulk.rows.value"
          @retry="bulk.retry"
          @close="bulk.close"
        />
        <ProblemMessage v-if="bulk.problem.value" :problem="bulk.problem.value" />
      </template>
      <template #empty-actions>
        <RouterLink
          v-if="permissions.canCreate"
          :to="{ name: 'domain-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_domain') }}
        </RouterLink>
      </template>
      <template #default>
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
          <template #actions="{ domain }">
            <DomainEntryActions
              :domain="domain"
              :can-delete="permissions.canDelete"
              @delete="deletion.start"
            />
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
    </ListState>

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

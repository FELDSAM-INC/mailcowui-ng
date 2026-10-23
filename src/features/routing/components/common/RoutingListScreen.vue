<script setup lang="ts" generic="T">
// A routing list screen (research R4, R5; legacy form map part 1a): the classic card's heading
// and hint, the section navigation, search, filters and sort, the four list states (loading, error
// with retry, "no entries yet" with the add action, "no entries match" with "clear"), the entries,
// legacy's DataTables paging texts, refresh, and selection mode with legacy's quick actions as bulk
// actions with a result per entry.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { lt } from '@/i18n'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import type { PageSize } from '@/shared/composables/useListState'
import { PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { problemOf } from '@/api'

import type { RoutingList } from '../../composables/useRoutingList'
import type { AnyBulkAction } from '../../logic/bulk-actions'
import { findScreen, type RoutingScreenId } from '../../screens'
import EntryList from './EntryList.vue'
import type { EntryColumn, FilterDef, SortChoice } from './entry-list'
import ListToolbar from './ListToolbar.vue'
import ScreenIntro from './ScreenIntro.vue'

const props = withDefaults(
  defineProps<{
    screen: RoutingScreenId
    controller: RoutingList<T>
    columns: readonly EntryColumn<T>[]
    filters: readonly FilterDef[]
    sorts: readonly SortChoice[]
    defaultSort: string
    actionsLabel: string
    /** The key of the column that names the entry (default: the first). */
    primary?: string
    bulkActions?: readonly AnyBulkAction[]
    writable?: boolean
    addTo?: RouteLocationRaw | null
    addLabel?: string
    editTo?: (entry: T) => RouteLocationRaw | null
  }>(),
  {
    primary: undefined,
    bulkActions: () => [],
    writable: false,
    addTo: null,
    addLabel: '',
    editTo: undefined,
  },
)

const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const info = computed(() => findScreen(props.screen))
const c = computed(() => props.controller)
const state = computed(() => c.value.list.state.value)
const selection = computed(() => c.value.selection)
const bulk = computed(() => c.value.bulk)
const canSelect = computed(() => props.writable && props.bulkActions.length > 0)

const pageIds = computed(() => c.value.entries.value.map((entry) => c.value.idOf(entry)))
const allSelected = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selection.value.isSelected(id) || !selection.value.canSelect(id)),
)
const limitMessage = computed(() =>
  selection.value.limitReached.value && selection.value.limit.value !== null
    ? t('bulk.limitReached', { max: selection.value.limit.value })
    : null,
)
const actions = computed(() =>
  props.bulkActions.map((action) => ({
    id: action,
    label: bulk.value.label(action),
    destructive: action === 'delete',
  })),
)

function toggleAll(checked: boolean) {
  if (checked) selection.value.selectPage(pageIds.value)
  else selection.value.clear()
}

function toggleSelecting() {
  if (selection.value.active.value) selection.value.leave()
  else selection.value.enter()
}

useLeaveGuard(() => bulk.value.phase.value === 'running', {
  titleKey: 'routing.bulk.leaveTitle',
  messageKey: 'routing.bulk.leaveRunning',
})
</script>

<template>
  <section
    class="mx-auto flex w-full max-w-7xl flex-col gap-4"
    :data-list-state="c.listState.value"
    :data-list-stale="c.query.isPlaceholderData.value ? '' : undefined"
    :data-screen="screen"
  >
    <PageHeader :title="lt(info.titleKey)">
      <template #actions>
        <slot name="header-actions" />
        <RouterLink
          v-if="writable && addTo"
          :to="addTo"
          :class="buttonVariants({ variant: 'default' })"
          data-add
        >
          <PlusIcon />
          {{ addLabel }}
        </RouterLink>
        <button
          v-if="canSelect"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :aria-pressed="selection.active.value ? 'true' : 'false'"
          @click="toggleSelecting"
        >
          {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
        </button>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          data-refresh
          @click="c.refresh()"
        >
          <SyncIcon :class="c.query.isFetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>

    <ScreenIntro :hint="info.hintKey" />
    <slot name="before-toolbar" />

    <ListToolbar
      :id-prefix="screen"
      :filters="filters"
      :sorts="sorts"
      :values="state.filters"
      :search="(state.filters.q as string | undefined) ?? ''"
      :sort="state.sort ?? defaultSort"
      :order="state.order ?? 'asc'"
      @search="(value) => c.list.setFilter('q', value || undefined, { typing: true })"
      @filter="(key, value) => c.list.setFilter(key, value)"
      @sort="(sort, order) => c.list.setSort(sort, order)"
      @clear="c.list.clearFilters()"
    />

    <ListState
      :loading="c.initialLoading.value"
      :failed="c.loadFailed.value"
      :problem="problemOf(c.query.error.value)"
      :empty="c.empty.value"
      :no-matches="c.noMatches.value"
      :skeleton="28"
      empty-layout="actions"
      :refresh-failed="c.refreshFailed.value"
      :refresh-text="t('routing.common.refreshFailed')"
      :no-matches-attrs="{ 'data-no-matches': '' }"
      :empty-attrs="{ 'data-empty': '' }"
      :clear-label="t('lists.chips.clearAll')"
      @clear="c.list.clearFilters()"
      @retry="c.refresh()"
    >
      <template #before-content>
        <slot name="before-list" />
        <div
          v-if="bulk.phase.value === 'running'"
          data-bulk-progress
          role="status"
          class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
        >
          <SyncIcon class="size-5 motion-safe:animate-spin" />
          {{ t('bulk.progress', { count: bulk.running.value }) }}
        </div>
        <BulkResultSummary
          v-else-if="bulk.phase.value === 'results' && bulk.rows.value.length > 0"
          :rows="bulk.rows.value"
          :message="bulk.message"
          @retry="bulk.retry()"
          @refresh="c.refresh()"
          @close="bulk.close()"
        />
        <ProblemMessage v-if="bulk.problem.value" :problem="bulk.problem.value" />
      </template>
      <template #empty-actions>
        <RouterLink
          v-if="writable && addTo"
          :to="addTo"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ addLabel }}
        </RouterLink>
      </template>
      <template #default>
        <div v-if="selection.active.value && !wide" class="flex items-center gap-2">
          <SelectCheckbox :label="t('bulk.selectAll')" :checked="allSelected" @change="toggleAll" />
          <span aria-hidden="true" class="text-sm text-gray-700 dark:text-gray-300">{{
            t('bulk.selectAll')
          }}</span>
        </div>
        <EntryList
          :entries="c.entries.value"
          :columns="columns"
          :id-of="c.idOf"
          :edit-to="editTo"
          :caption="lt(info.titleKey)"
          :actions-label="actionsLabel"
          :primary="primary"
          :sort="state.sort ?? defaultSort"
          :order="state.order ?? 'asc'"
          :selectable="selection.active.value"
          @sort="(sort, order) => c.list.setSort(sort, order)"
        >
          <template v-for="column in columns" :key="column.key" #[`cell-${column.key}`]="{ entry }">
            <slot :name="`cell-${column.key}`" :entry="entry">
              <RouterLink
                v-if="column.key === (primary ?? columns[0]?.key) && editTo?.(entry)"
                :to="editTo(entry)!"
                class="inline-flex min-h-11 min-w-11 items-center font-semibold wrap-anywhere text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
              >
                {{ column.text?.(entry) }}
              </RouterLink>
              <template v-else>{{ column.text?.(entry) }} </template>
            </slot>
          </template>
          <template #select-all>
            <SelectCheckbox
              :label="t('bulk.selectAll')"
              :checked="allSelected"
              @change="toggleAll"
            />
          </template>
          <template #select="{ entry }">
            <SelectCheckbox
              :label="t('bulk.selectItem', { name: c.nameOf(entry) })"
              :checked="selection.isSelected(c.idOf(entry))"
              :disabled="!selection.canSelect(c.idOf(entry))"
              described-by="bulk-limit-message"
              @change="selection.toggle(c.idOf(entry))"
            />
          </template>
          <template #actions="{ entry }">
            <slot name="actions" :entry="entry" />
          </template>
        </EntryList>
        <PaginationBar
          :total="c.total.value"
          :page="state.page"
          :size="state.size"
          :page-sizes="c.capabilities.pageSizes.value"
          @update:page="c.list.setPage"
          @update:size="(size) => c.list.setSize(size as PageSize)"
        />
      </template>
    </ListState>
    <BulkActionBar
      v-if="selection.active.value"
      :count="selection.count.value"
      :actions="actions"
      :limit-message="limitMessage"
      :busy="bulk.phase.value === 'running'"
      @action="(id) => bulk.run(id as AnyBulkAction)"
      @clear="selection.clear()"
    />
  </section>
</template>

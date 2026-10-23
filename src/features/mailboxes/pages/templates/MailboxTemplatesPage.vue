<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import { useDataList } from '@/shared/composables/useDataList'

// The mailbox templates (US7, FR-058, FR-062, FR-063, FR-065): a name search, the sort, pages and
// page size in the address; cards below md and a table from md up with the classic columns and
// Default marked; the list states. Administrators add templates, delete one from its entry's
// actions, and use the classic "Remove" of selected templates in selection mode with the API's
// bulk operation (gap G39), a result per template and a retry; Default is never selectable.
// Domain administrators read the templates only.
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useListQueryState } from '@/shared/composables/useListQueryState'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { useFilteredListAnnouncement } from '@/shared/composables/useFilteredListAnnouncement'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import TemplateEntryActions from '../../components/templates/TemplateEntryActions.vue'
import TemplateList from '../../components/templates/TemplateList.vue'

import { useMailboxCapabilities } from '../../composables/useMailboxCapabilities'
import { useTemplateListState } from '../../templates/list-state'
import { useTemplateBulkDelete } from '../../templates/useTemplateBulkDelete'
import { useTemplateDeletion } from '../../templates/useTemplateDeletion'
import { templateListOptions } from '../../templates-api'

const { t } = useI18n()
const fmt = useFormat()
const wideList = useMediaQuery('(min-width: 768px)')
const identityQuery = useIdentityQuery()
const manage = computed(() => identityQuery.data.value?.role === 'admin')
const capabilities = useMailboxCapabilities()
const selection = useBulkSelection({ limit: () => capabilities.data.value?.bulkLimit })
const list = useTemplateListState({ onReset: () => selection.clear() })
const deletion = useTemplateDeletion()
const state = computed(() => list.state.value)

const query = useQuery(
  computed(() => ({
    ...templateListOptions(list.params.value),
    placeholderData: keepPreviousData,
  })),
)
const templates = computed(() => query.data.value?.data ?? [])
const { total, initialLoading, loadFailed, refreshFailed, empty, noMatches, listState } =
  useListQueryState(query, () => list.hasSearch.value)
const countText = computed(() =>
  t('domainTemplates.list.count', { count: fmt.number(total.value) }),
)

function search(value: string) {
  void list.setFilter('q', value || undefined, { typing: true })
}
function clearSearch() {
  void list.setFilter('q', undefined)
}

// FR-073: the result count is announced after a search, without moving focus.
useFilteredListAnnouncement(query, state, () => countText.value)

function refresh() {
  void query.refetch()
}

// The classic "Remove" of selected templates (G39); Default is never selectable.
const bulk = useTemplateBulkDelete({ selection, entries: () => templates.value })
const pageIds = computed(() =>
  templates.value.filter((item) => !item.isDefault).map((item) => String(item.id)),
)
const limitMessage = computed(() =>
  selection.limitReached.value && selection.limit.value !== null
    ? t('bulk.limitReached', { max: fmt.number(selection.limit.value) })
    : null,
)
const allSelected = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selection.isSelected(id) || !selection.canSelect(id)),
)
const BULK_ACTIONS = computed(() => [
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

useDataList('mailboxes-pages-templates-mailboxtemplates', undefined, () => ({
  run: refresh,
  pending: query.isFetching.value,
  disabled: false,
}))
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <PageHeader :title="lt('mailbox.mailbox_templates')">
      <template #actions>
        <template v-if="manage">
          <RouterLink
            :to="{ name: 'mailbox-template-create' }"
            :class="buttonVariants({ variant: 'default' })"
          >
            <PlusIcon />
            {{ lt('mailbox.add_template') }}
          </RouterLink>
        </template>
      </template>
    </PageHeader>

    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <ListToolbar
        ><template #select
          ><button
            v-if="manage"
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :aria-pressed="selection.active.value ? 'true' : 'false'"
            @click="toggleSelecting"
          >
            {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
          </button></template
        ><template #search
          ><SearchField
            id="template-search"
            :label="lt('datatables.search')"
            :model-value="state.filters.q ?? ''"
            @search="search" /></template
      ></ListToolbar>
    </div>

    <ListState
      :loading="initialLoading"
      :failed="loadFailed"
      :problem="problemOf(query.error.value)"
      :empty="empty"
      :no-matches="noMatches"
      :skeleton="32"
      empty-layout="plain"
      :refresh-failed="refreshFailed"
      :refresh-text="t('domains.list.refreshFailed')"
      :clear-label="t('lists.search.clear')"
      @clear="clearSearch"
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
          {{ t('bulk.progress', { count: bulk.running.value }) }}
        </div>
        <BulkResultSummary
          v-else-if="bulk.phase.value === 'results' && bulk.rows.value.length > 0"
          :rows="bulk.rows.value"
          @retry="bulk.retry"
          @close="bulk.close"
          @refresh="refresh"
        />
        <ProblemMessage v-if="bulk.problem.value" :problem="bulk.problem.value" />
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
        <TemplateList
          :templates="templates"
          :selectable="manage && selection.active.value"
          :actions="manage"
          :sort="state.sort ?? 'name'"
          :order="state.order ?? 'asc'"
          @sort="(sort, order) => list.setSort(sort, order)"
        >
          <template #actions="{ template }">
            <TemplateEntryActions :template="template" @delete="deletion.start" />
          </template>
          <template #select-all>
            <SelectCheckbox
              :label="t('bulk.selectAll')"
              :checked="allSelected"
              @change="toggleAll"
            />
          </template>
          <template #select="{ template }">
            <SelectCheckbox
              v-if="!template.isDefault"
              :label="t('bulk.selectItem', { name: template.name })"
              :checked="selection.isSelected(String(template.id))"
              :disabled="!selection.canSelect(String(template.id))"
              described-by="bulk-limit-message"
              @change="selection.toggle(String(template.id))"
            />
          </template>
        </TemplateList>
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
      v-if="manage && selection.active.value"
      :count="selection.count.value"
      :actions="BULK_ACTIONS"
      :limit-message="limitMessage"
      :busy="bulk.phase.value === 'running'"
      @action="bulk.run()"
      @clear="selection.clear()"
    />
  </section>
</template>

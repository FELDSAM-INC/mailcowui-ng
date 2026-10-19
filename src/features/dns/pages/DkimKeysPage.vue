<script setup lang="ts">
// The ARC/DKIM keys (US1, FR-005 to FR-015; legacy `admin/tab-config-dkim.twig`): every DKIM entry
// in scope with the classic state toggles as filters, kind, completeness, selector and domain
// filters, search, sort, pages and page size in the address; cards below md and a table from md up;
// the four list states; a refresh that keeps the results when it fails; the result count announced
// after a search or filter change; and the server settings for administrators. US2: selection mode
// on the current page with the bulk bar (legacy's multi-select), generation for the selection or
// for every name without a key (legacy's "Select domains with missing keys"), and the run's
// progress and results, guarded against leaving while it runs.
import { useQuery } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { useDnsCapabilities } from '../api/capabilities'
import { dkimListOptions, fetchDkimKeys } from '../api/dkim'
import DkimEntryList from '../components/DkimEntryList.vue'
import GenerateKeyDialog from '../components/GenerateKeyDialog.vue'
import NamePreview from '../components/NamePreview.vue'
import RunDialog from '../components/RunDialog.vue'
import DkimFilters from '../components/DkimFilters.vue'
import DkimSettingsSummary from '../components/DkimSettingsSummary.vue'
import DkimSortControl from '../components/DkimSortControl.vue'
import {
  useDkimRun,
  useSingleGeneration,
  type GenerationValues,
} from '../composables/useDkimGeneration'
import { useDnsRole } from '../composables/useDnsRole'
import { dkimBulkActions, splitSelection, type DkimBulkActionId } from '../dkim/bulk'
import { collectMissingNames, type RunName } from '../dkim/generate-run'
import { useDkimListState, type DkimListFilters } from '../dkim/list-state'
import { dkimKeyLocation } from '../names'
import { dkimListActions } from '../permissions'

const { t, locale } = useI18n()
const router = useRouter()
const wideList = useMediaQuery('(min-width: 768px)')
const { role } = useDnsRole()
const capabilities = useDnsCapabilities()
const listActions = computed(() => dkimListActions(role.value ?? 'mailboxUser'))
const selection = useBulkSelection({ limit: () => capabilities.data.value?.dkim.bulkLimit })
const list = useDkimListState(role.value, { onReset: () => selection.clear() })
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

// US2: selection mode (conventions "Bulk actions"): the current page only, up to the bulk limit.
const number = (value: number) => formatNumber(value, locale.value as AppLocale)
const pageIds = computed(() => entries.value.map((entry) => entry.name))
const allSelected = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selection.isSelected(id) || !selection.canSelect(id)),
)
const limitMessage = computed(() =>
  selection.limitReached.value && selection.limit.value !== null
    ? t('bulk.limitReached', { max: number(selection.limit.value) })
    : null,
)
const bulkActions = computed(() => dkimBulkActions(role.value))
function toggleAll(checked: boolean) {
  if (checked) selection.selectPage(pageIds.value)
  else selection.clear()
}
function toggleSelecting() {
  if (selection.active.value) selection.leave()
  else selection.enter()
}
const selectedEntries = computed(() =>
  entries.value.filter((entry) => selection.isSelected(entry.name)),
)
const asName = (entry: { name: string; displayName: string }): RunName => ({
  name: entry.name,
  label: entry.displayName,
})

// Generation (FR-024 to FR-028, FR-040 to FR-042).
const generateOpen = ref(false)
const generateNames = shallowRef<RunName[]>([])
const generateSkipped = shallowRef<RunName[]>([])
const single = useSingleGeneration((result) => void router.push(dkimKeyLocation(result.name)))
const run = useDkimRun()
const runOpen = ref(false)

function openGeneration(names: RunName[], skipped: RunName[]) {
  if (names.length === 1 && skipped.length === 0) {
    single.start(names[0]!)
    return
  }
  generateNames.value = names
  generateSkipped.value = skipped
  generateOpen.value = true
}

async function onBulk(id: string) {
  if ((id as DkimBulkActionId) !== 'generate') return
  const { targets, skipped } = splitSelection(selectedEntries.value, 'generate')
  if (targets.length === 0) {
    announce(t('dns.dkim.allMissing.none'))
    return
  }
  openGeneration(targets.map(asName), skipped.map(asName))
}

async function startRun(values: GenerationValues) {
  generateOpen.value = false
  runOpen.value = true
  await run.start(generateNames.value, generateSkipped.value, values)
  const kept = run.rows.value.filter((row) => row.outcome !== 'created').map((row) => row.name)
  selection.keep(kept)
}

const collecting = ref(false)
const allMissingProblem = shallowRef<unknown>(null)
async function generateAllMissing() {
  if (collecting.value) return
  collecting.value = true
  allMissingProblem.value = null
  try {
    const names = await collectMissingNames(
      { q: state.value.filters.q, kind: state.value.filters.kind },
      fetchDkimKeys,
    )
    if (names.length === 0) {
      announce(t('dns.dkim.allMissing.none'))
      return
    }
    const filtered = !!state.value.filters.q || !!state.value.filters.kind
    const go = await confirm({
      title: lt('admin.dkim_domains_wo_keys'),
      description: t('dns.dkim.allMissing.body', { count: number(names.length) }),
      confirmLabel: t('dns.dkim.allMissing.continue'),
      content: { component: NamePreview, props: { names, filtered } },
    })
    if (go) openGeneration(names, [])
  } catch (error) {
    allMissingProblem.value = error
  } finally {
    collecting.value = false
  }
}

const guard = useLeaveGuard(() => run.running.value, {
  titleKey: 'dns.dkim.run.leaveTitle',
  messageKey: 'dns.dkim.run.leaveBody',
  leaveKey: 'dns.dkim.run.leave',
  stayKey: 'leaveGuard.stay',
})
void guard
onBeforeUnmount(() => run.stop())
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <PageHeader :title="lt('admin.dkim_keys')">
      <template #actions>
        <RouterLink
          v-if="listActions.importFromList"
          :to="{ name: 'dkim-import' }"
          :class="buttonVariants({ variant: 'outline' })"
        >
          <PlusIcon />
          {{ lt('admin.import_private_key') }}
        </RouterLink>
        <button
          v-if="listActions.selectionGenerate"
          type="button"
          data-generate-missing
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="collecting || !capabilities.data.value"
          @click="generateAllMissing"
        >
          {{ lt('admin.dkim_domains_wo_keys') }}
        </button>
        <button
          v-if="listActions.selectionGenerate"
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

      <p v-if="collecting" role="status" class="text-sm text-gray-700 dark:text-gray-300">
        {{ t('dns.dkim.allMissing.collecting') }}
      </p>
      <ProblemMessage v-if="allMissingProblem" :problem="problemOf(allMissingProblem)" />

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
        <div v-if="selection.active.value && !wideList" class="flex items-center gap-2">
          <SelectCheckbox
            :label="lt('mailbox.toggle_all')"
            :checked="allSelected"
            described-by="bulk-limit-message"
            @change="toggleAll"
          />
          <span aria-hidden="true" class="text-sm text-gray-700 dark:text-gray-300">{{
            lt('mailbox.toggle_all')
          }}</span>
        </div>
        <DkimEntryList
          :entries="entries"
          :sort="state.sort ?? 'name'"
          :order="state.order ?? 'asc'"
          :selectable="selection.active.value"
          @sort="(sort, order) => list.setSort(sort, order)"
          @filter-selector="(selector) => list.setFilter('selector', selector)"
        >
          <template #select-all>
            <SelectCheckbox
              :label="lt('mailbox.toggle_all')"
              :checked="allSelected"
              described-by="bulk-limit-message"
              @change="toggleAll"
            />
          </template>
          <template #select="{ entry }">
            <SelectCheckbox
              :label="t('bulk.selectItem', { name: entry.displayName })"
              :checked="selection.isSelected(entry.name)"
              :disabled="!selection.canSelect(entry.name)"
              described-by="bulk-limit-message"
              @change="selection.toggle(entry.name)"
            />
          </template>
        </DkimEntryList>
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
      :actions="bulkActions"
      :limit-message="limitMessage"
      :busy="run.running.value"
      @action="onBulk"
      @clear="selection.clear()"
    />

    <GenerateKeyDialog
      v-if="capabilities.data.value"
      v-model:open="generateOpen"
      :names="generateNames"
      :skipped="generateSkipped"
      :caps="capabilities.data.value"
      @submit="startRun"
    />
    <GenerateKeyDialog
      v-if="capabilities.data.value"
      v-model:open="single.open.value"
      :names="single.names.value"
      :caps="capabilities.data.value"
      :pending="single.pending.value"
      :problem="single.problem.value"
      @submit="single.submit"
    />
    <RunDialog
      v-model:open="runOpen"
      :title="lt('admin.dkim_add_key')"
      :rows="run.rows.value"
      :total="run.total.value"
      :current="run.current.value"
      :running="run.running.value"
      mode="generate"
      :publication="capabilities.data.value?.dkim.dnsPublicationEnabled ?? false"
      :stop-problem="run.stopProblem.value"
      @stop="run.stop()"
      @retry="(names) => run.retry(names)"
    />
  </section>
</template>

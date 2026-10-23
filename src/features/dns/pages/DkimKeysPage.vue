<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import { useDataList } from '@/shared/composables/useDataList'

// The ARC/DKIM keys (US1, FR-005 to FR-015; legacy `admin/tab-config-dkim.twig`): every DKIM entry
// in scope with the classic state toggles as filters, kind, completeness, selector and domain
// filters, search, sort, pages and page size in the address; cards below md and a table from md up;
// the four list states; a refresh that keeps the results when it fails; the result count announced
// after a search or filter change; and the server settings for administrators. US2: selection mode
// on the current page with the bulk bar (legacy's multi-select), generation for the selection or
// for every name without a key (legacy's "Select domains with missing keys"), and the run's
// progress and results, guarded against leaving while it runs.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useListQueryState } from '@/shared/composables/useListQueryState'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { isApiProblem, problemOf, type DkimDnsPublicationOutcome } from '@/api'
import { useFilteredListAnnouncement } from '@/shared/composables/useFilteredListAnnouncement'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import { rowsFromBulkResult, unknownRows, type BulkRow } from '@/shared/components/bulk-row'
import ListState from '@/shared/components/ListState.vue'
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
import { deleteKeys, dkimListOptions, fetchDkimKeys } from '../api/dkim'
import BulkDeleteImpact from '../components/BulkDeleteImpact.vue'
import PublicationOutcome from '../components/PublicationOutcome.vue'
import DkimEntryList from '../components/DkimEntryList.vue'
import GenerateKeyDialog from '../components/GenerateKeyDialog.vue'
import NamePreview from '../components/NamePreview.vue'
import RunDialog from '../components/RunDialog.vue'
import DkimFilters from '../components/DkimFilters.vue'
import DkimSettingsSummary from '../components/DkimSettingsSummary.vue'

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
const { total, initialLoading, loadFailed, refreshFailed, empty, noMatches, listState } =
  useListQueryState(query, () => list.hasSearchOrFilters.value)
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
useFilteredListAnnouncement(query, state, () => countText.value)

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

// US5 (FR-038, FR-040, FR-092): deleting the selected keys in one bulk request with their version
// tags, after the number of keys is typed; failed, refused and outdated keys stay selected.
const queryClient = useQueryClient()
const bulkRows = shallowRef<BulkRow[]>([])
const bulkPublication = shallowRef<Record<string, DkimDnsPublicationOutcome>>({})
const deleting = ref(false)

async function deleteSelected() {
  const { targets, skipped } = splitSelection(selectedEntries.value, 'delete')
  if (targets.length === 0) return
  const publication = capabilities.data.value?.dkim.dnsPublicationEnabled ?? false
  const go = await confirm({
    title: lt('footer.confirm_delete'),
    description: lt('footer.delete_these_items'),
    confirmLabel: lt('footer.delete_now'),
    cancelLabel: lt('footer.cancel'),
    destructive: true,
    content: { component: BulkDeleteImpact, props: { targets, skipped, publication } },
    requireTyped: {
      accepted: [String(targets.length)],
      labelKey: 'bulk.confirm.typeCount',
      labelParams: { count: targets.length },
    },
  })
  if (!go) return
  const entriesFor = targets.map((entry) => ({ name: entry.name, unicodeName: entry.displayName }))
  deleting.value = true
  bulkRows.value = []
  try {
    const outcome = await deleteKeys(
      queryClient,
      targets.map((entry) => ({ id: entry.name, ...(entry.etag ? { version: entry.etag } : {}) })),
    )
    bulkPublication.value = outcome.publication
    bulkRows.value = [
      ...rowsFromBulkResult(outcome.result, entriesFor),
      ...skipped.map((entry) => ({
        id: entry.name,
        label: entry.displayName,
        outcome: 'skipped' as const,
      })),
    ]
    selection.keep(
      bulkRows.value
        .filter((row) => ['failed', 'refused', 'outdated'].includes(row.outcome))
        .map((row) => row.id),
    )
  } catch (error) {
    if (isApiProblem(error) && (error.kind === 'network' || error.kind === 'unavailable')) {
      bulkRows.value = unknownRows(entriesFor)
    } else {
      allMissingProblem.value = error
    }
  } finally {
    deleting.value = false
  }
}

function bulkMessage(row: BulkRow): string | null {
  if (row.outcome === 'done') return lt('success.dkim_removed', row.id)
  return null
}

function onBulk(id: string) {
  if ((id as DkimBulkActionId) === 'delete') {
    void deleteSelected()
    return
  }
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

useDataList('dns-pages-dkimkeys')
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

        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="refresh">
          <SyncIcon :class="query.isFetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>

    <!-- Shown at once with placeholders, so that the list does not move when the settings arrive. -->
    <DkimSettingsSummary
      v-if="role === 'admin' && !(capabilities.isError.value && !capabilities.data.value)"
      :caps="capabilities.data.value"
    />

    <div class="flex flex-col gap-3">
      <ListToolbar
        ><template #select
          ><button
            v-if="listActions.selectionGenerate"
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :aria-pressed="selection.active.value ? 'true' : 'false'"
            @click="toggleSelecting"
          >
            {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
          </button></template
        ><template #filters
          ><DkimFilters
            :role="role"
            :states="state.filters.state"
            :kind="state.filters.kind"
            :complete="state.filters.complete"
            :selector="state.filters.selector"
            :domain="state.filters.domain"
            :active-count="list.activeFilterCount.value"
            @update="updateFilters"
            @clear="clearFilters" /></template
        ><template #search
          ><SearchField
            id="dkim-search"
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
      :refresh-failed="refreshFailed"
      :refresh-text="t('dns.dkim.list.refreshFailed')"
      :empty-attrs="{ 'data-dkim-empty': '' }"
      :clear-label="t('lists.chips.clearAll')"
      @clear="clearAll"
      @retry="refresh"
    >
      <template #before-content>
        <p v-if="collecting" role="status" class="text-sm text-gray-700 dark:text-gray-300">
          {{ t('dns.dkim.allMissing.collecting') }}
        </p>
        <ProblemMessage v-if="allMissingProblem" :problem="problemOf(allMissingProblem)" />
        <p v-if="deleting" role="status" class="text-sm text-gray-700 dark:text-gray-300">
          {{ t('bulk.progress', { count: selection.count.value }) }}
        </p>
        <BulkResultSummary
          v-else-if="bulkRows.length > 0"
          data-bulk-results
          :rows="bulkRows"
          :message="bulkMessage"
          @retry="deleteSelected"
          @refresh="refresh"
          @close="bulkRows = []"
        >
          <template #item="{ row }">
            <PublicationOutcome
              v-if="bulkPublication[row.id]"
              :outcome="bulkPublication[row.id]!"
              :enabled="capabilities.data.value?.dkim.dnsPublicationEnabled ?? false"
            />
          </template>
        </BulkResultSummary>
      </template>
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
    </ListState>

    <BulkActionBar
      v-if="selection.active.value"
      :count="selection.count.value"
      :actions="bulkActions"
      :limit-message="limitMessage"
      :busy="run.running.value || deleting"
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

<script setup lang="ts">
// The mailbox list (US1, FR-005 to FR-014), the classic "Mailboxes" tab
// (`mailbox/tab-mailboxes.twig`, `draw_mailbox_table()`): legacy's title, "Add mailbox" and
// refresh; the server's search, filters, sort and paging in the address; cards below md and
// legacy's table from md up with the column chooser; the list states with DataTables' texts; and
// the entries shown announced after a search or filter change. The search commits with a new
// history entry 500 ms after the last keystroke (research R7), so Back restores the previous list.
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import type { MailboxAuthSource } from '@/api'
import { lt, text } from '@/i18n'
import { useFormat } from '@/i18n/format'
import ActiveFilterChips from '@/shared/components/ActiveFilterChips.vue'
import type { DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import type { PageSize } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { problemOf } from '@/api'
import { mailboxListOptions } from '../api'
import { authSourceOptions } from '../auth-source'
import { COLUMNS, readColumns, writeColumns, type ColumnId } from '../columns'
import ColumnChooser from '../components/list/ColumnChooser.vue'
import MailboxFilters from '../components/list/MailboxFilters.vue'
import MailboxList from '../components/list/MailboxList.vue'
import MailboxRowActions from '../components/list/MailboxRowActions.vue'
import { useMailboxCapabilities } from '../composables/useMailboxCapabilities'
import { useMailboxFieldDisplay } from '../field-display'
import { statusLabelKey } from '../labels'
import { NO_FILTERS, useMailboxListState, type MailboxListFilters } from '../list-state'

const { t } = useI18n()
const router = useRouter()
const fmt = useFormat()
const display = useMailboxFieldDisplay()
const wide = useMediaQuery('(min-width: 768px)')
const capabilities = useMailboxCapabilities()
const list = useMailboxListState()
const state = computed(() => list.state.value)
const canCreate = computed(() => router.hasRoute('mailbox-create'))

const query = useQuery(
  computed(() => ({ ...mailboxListOptions(list.params.value), placeholderData: keepPreviousData })),
)
const mailboxes = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)

// Columns: legacy's visible ones, without the last logins when the server does not report them,
// and the chosen row details.
const chosen = ref<ColumnId[]>(readColumns())
watch(chosen, (value) => writeColumns(value))
const columns = computed(() =>
  COLUMNS.filter((column) =>
    column.default
      ? column.id !== 'lastMailLogin' || capabilities.data.value?.lastLoginsReported !== false
      : chosen.value.includes(column.id),
  ),
)

const sources = computed<MailboxAuthSource[]>(() => authSourceOptions(capabilities.data.value))

/** Readable names of the domains picked in the filters, for their chips. */
const labels = ref<Record<string, string>>({})
function remember(option: DomainPickerOption) {
  labels.value = { ...labels.value, [option.name]: option.nameUnicode }
}

function updateFilters(change: Partial<MailboxListFilters>) {
  void list.setFilters(change)
}
function clearFilters() {
  updateFilters({ ...NO_FILTERS, q: state.value.filters.q })
}

interface Chip {
  key: string
  label: string
  change: Partial<MailboxListFilters>
}
const chips = computed<Chip[]>(() => {
  const { domain, status, tag, source } = state.value.filters
  return [
    ...domain.map((value) => ({
      key: `domain-${value}`,
      label: `${lt('mailbox.domain')}: ${labels.value[value] ?? value}`,
      change: { domain: domain.filter((item) => item !== value) },
    })),
    ...status.map((value) => ({
      key: `status-${value}`,
      label: `${lt('mailbox.status')}: ${text(statusLabelKey(value))}`,
      change: { status: status.filter((item) => item !== value) },
    })),
    ...tag.map((value) => ({
      key: `tag-${value}`,
      label: `${lt('add.tags')}: ${value}`,
      change: { tag: tag.filter((item) => item !== value) },
    })),
    ...source.map((value) => ({
      key: `source-${value}`,
      label: `${lt('mailbox.iam')}: ${display.source(value)}`,
      change: { source: source.filter((item) => item !== value) },
    })),
  ]
})
function removeChip(key: string) {
  const chip = chips.value.find((item) => item.key === key)
  if (chip) updateFilters(chip.change)
}

// FR-009: the entries shown are announced after a search or filter change, without moving focus.
const filterKey = computed(() => JSON.stringify(state.value.filters))
let announcedFor = filterKey.value
watch(
  () => [query.data.value, query.isPlaceholderData.value] as const,
  ([data, placeholder]) => {
    if (!data || placeholder || filterKey.value === announcedFor) return
    announcedFor = filterKey.value
    const { page, size } = state.value
    announce(
      data.meta.total === 0
        ? lt('datatables.infoEmpty')
        : lt('datatables.info', {
            _START_: fmt.number((page - 1) * size + 1),
            _END_: fmt.number(Math.min(data.meta.total, page * size)),
            _TOTAL_: fmt.number(data.meta.total),
          }),
    )
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
  <section
    class="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4"
    :data-list-state="listState"
  >
    <PageHeader :title="lt('mailbox.mailboxes')">
      <template #actions>
        <RouterLink
          v-if="canCreate"
          :to="{ name: 'mailbox-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_mailbox') }}
        </RouterLink>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="refresh">
          <SyncIcon :class="query.isFetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>

    <SearchField
      id="mailbox-search"
      :label="lt('datatables.search')"
      :model-value="state.filters.q ?? ''"
      @search="(value) => list.setFilter('q', value || undefined)"
    />
    <div class="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <MailboxFilters
        class="md:flex-1"
        :filters="state.filters"
        :active-count="list.activeFilterCount.value"
        :sources="sources"
        :labels="labels"
        :tag-max-length="capabilities.data.value?.tagMaxLength"
        :show-sort="!wide"
        :sort="state.sort ?? 'address'"
        :order="state.order ?? 'asc'"
        @pick="remember"
        @update="updateFilters"
        @sort="(sort, order) => list.setSort(sort, order)"
      />
      <ColumnChooser v-if="wide" v-model="chosen" />
    </div>
    <ActiveFilterChips :chips="chips" @remove="removeChip" @clear="clearFilters" />

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
        {{ t('domains.list.refreshFailed') }}
      </p>

      <div v-if="noMatches" data-empty="noMatch" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.zeroRecords') }}</p>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="updateFilters(NO_FILTERS)"
        >
          {{ t('lists.chips.clearAll') }}
        </button>
      </div>

      <div v-else-if="empty" data-empty="none" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.emptyTable') }}</p>
        <RouterLink
          v-if="canCreate"
          :to="{ name: 'mailbox-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('mailbox.add_mailbox') }}
        </RouterLink>
      </div>

      <template v-else>
        <MailboxList
          :mailboxes="mailboxes"
          :columns="columns"
          :sort="state.sort ?? 'address'"
          :order="state.order ?? 'asc'"
          @sort="(sort, order) => list.setSort(sort, order)"
        >
          <template #actions="{ mailbox }">
            <MailboxRowActions :mailbox="mailbox" />
          </template>
        </MailboxList>
        <PaginationBar
          :total="total"
          :page="state.page"
          :size="state.size"
          :page-sizes="list.pageSizes"
          @update:page="list.setPage"
          @update:size="(size) => list.setSize(size as PageSize)"
        />
      </template>
    </template>
  </section>
</template>

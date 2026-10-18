<script setup lang="ts">
// The OAuth2 apps (UI 012 US5, FR-054 to FR-057, FR-065), mirroring the classic tab
// `templates/admin/tab-config-oauth2.twig` and `js/site/admin.js` draw_oauth2_clients: the classic
// information text, a search, the sort, pages and page size in the address; the columns ID, Client
// ID, Redirect URI and Action as cards below md and a table from md up (no secret, owner decision;
// no token counts or token filter, which legacy lacks); the four list states; Edit and Remove per
// client; and the classic quick actions of selected clients in selection mode, with the API's bulk
// operation, a result per client and a retry. New secrets of a renewal are shown once each.
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import OneTimeSecretDialog from '@/shared/components/OneTimeSecretDialog.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { PlusIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import SectionNav from '../../components/SectionNav.vue'
import { oauth2ListOptions, problemOf, useOauth2Capabilities } from '../api'
import Oauth2ClientActions from '../components/Oauth2ClientActions.vue'
import Oauth2ClientList from '../components/Oauth2ClientList.vue'
import Oauth2ClientSortControl from '../components/Oauth2ClientSortControl.vue'
import { BULK_LABELS, useOauth2Bulk, type Oauth2BulkAction } from '../composables/useOauth2Bulk'
import { useOauth2Deletion } from '../composables/useOauth2Deletion'
import { useOauth2ListState } from '../list-state'

const { t, locale } = useI18n()
const wideList = useMediaQuery('(min-width: 768px)')
const capabilities = useOauth2Capabilities()
const selection = useBulkSelection({ limit: () => capabilities.data.value?.bulkLimit })
const list = useOauth2ListState({ onReset: () => selection.clear() })
const deletion = useOauth2Deletion()
const state = computed(() => list.state.value)

const query = useQuery(
  computed(() => ({ ...oauth2ListOptions(list.params.value), placeholderData: keepPreviousData })),
)
const clients = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)

// Search (UI 004's SearchField): written with router.replace, so typing adds no history entries.
function onSearch(value: string) {
  void list.setFilter('q', value || undefined, { typing: true })
}
function clearSearch() {
  void list.setFilter('q', undefined)
}

// The classic DataTables summary of the entries shown, announced after a search.
const number = (value: number) => formatNumber(value, locale.value as AppLocale)
const shownText = computed(() =>
  total.value === 0
    ? lt('datatables.infoEmpty')
    : lt('datatables.info', {
        _START_: number((state.value.page - 1) * state.value.size + 1),
        _END_: number(Math.min(total.value, state.value.page * state.value.size)),
        _TOTAL_: number(total.value),
      }),
)
let announcedFor = state.value.filters.q
watch(
  () => [query.data.value, query.isPlaceholderData.value] as const,
  ([data, placeholder]) => {
    if (!data || placeholder || state.value.filters.q === announcedFor) return
    announcedFor = state.value.filters.q
    announce(shownText.value)
  },
)

const initialLoading = computed(() => query.isPending.value)
const loadFailed = computed(() => query.isError.value && !query.data.value)
const refreshFailed = computed(() => query.isError.value && !!query.data.value)
const empty = computed(
  () => !!query.data.value && !query.isPlaceholderData.value && total.value === 0,
)
const noMatches = computed(() => empty.value && list.hasSearch.value)
const listState = computed(() =>
  initialLoading.value ? 'loading' : loadFailed.value ? 'error' : empty.value ? 'empty' : 'ready',
)

// The classic quick actions of selected clients (FR-065, gap G42).
const bulk = useOauth2Bulk({ selection, entries: () => clients.value })
const pageIds = computed(() => clients.value.map((client) => String(client.id)))
const limitMessage = computed(() =>
  selection.limitReached.value && selection.limit.value !== null
    ? t('bulk.limitReached', { max: number(selection.limit.value) })
    : null,
)
const allSelected = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selection.isSelected(id) || !selection.canSelect(id)),
)
const BULK_ACTIONS = computed(() =>
  (['delete', 'revokeTokens', 'renewSecret'] as const).map((id) => ({
    id,
    label: lt(BULK_LABELS[id]),
    destructive: id === 'delete',
  })),
)
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

// New secrets: one dialog per client; leaving while one is shown asks the dialog first.
const dialog = useTemplateRef<InstanceType<typeof OneTimeSecretDialog>>('dialog')
onBeforeRouteLeave(async () => {
  if (!bulk.secret.value) return true
  return (await dialog.value?.requestClose()) ?? true
})
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4" :data-list-state="listState">
    <SectionNav />
    <PageHeader :title="lt('admin.oauth2_apps')">
      <template #actions>
        <RouterLink
          :to="{ name: 'oauth2-client-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('admin.oauth2_add_client') }}
        </RouterLink>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :aria-pressed="selection.active.value ? 'true' : 'false'"
          @click="toggleSelecting"
        >
          {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
        </button>
      </template>
    </PageHeader>

    <LegacyText
      k="admin.oauth2_info"
      as="div"
      data-oauth2-info
      class="text-sm wrap-anywhere text-gray-700 dark:text-gray-300 [&_code]:font-mono [&_ul]:list-disc [&_ul]:ps-5"
    />

    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <SearchField
        id="oauth2-search"
        class="md:max-w-md md:flex-1"
        :label="lt('datatables.search')"
        :model-value="state.filters.q ?? ''"
        @search="onSearch"
      />
      <Oauth2ClientSortControl
        :sort="state.sort ?? 'id'"
        :order="state.order ?? 'asc'"
        @change="(sort, order) => list.setSort(sort, order)"
      />
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
        class="h-28 rounded-2xl border border-gray-200 bg-gray-100 motion-safe:animate-pulse dark:border-gray-800 dark:bg-gray-900"
      />
    </div>

    <div v-else-if="loadFailed" class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('states.list.error') }}
      </p>
      <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
    </div>

    <template v-else>
      <p
        v-if="refreshFailed"
        role="alert"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        {{ t('domains.list.refreshFailed') }}
      </p>
      <ProblemMessage v-if="deletion.problem.value" :problem="deletion.problem.value" />

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
        @refresh="query.refetch()"
        @close="bulk.close"
      />
      <ProblemMessage v-if="bulk.problem.value" :problem="bulk.problem.value" />

      <div v-if="noMatches" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.zeroRecords') }}</p>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clearSearch">
          {{ t('lists.search.clear') }}
        </button>
      </div>

      <div v-else-if="empty" class="flex flex-col items-start gap-3 py-6">
        <p class="text-gray-700 dark:text-gray-300">{{ lt('datatables.emptyTable') }}</p>
        <RouterLink
          :to="{ name: 'oauth2-client-create' }"
          :class="buttonVariants({ variant: 'default' })"
        >
          <PlusIcon />
          {{ lt('admin.oauth2_add_client') }}
        </RouterLink>
      </div>

      <template v-else>
        <div v-if="selection.active.value && !wideList" class="flex items-center gap-2">
          <SelectCheckbox :label="t('bulk.selectAll')" :checked="allSelected" @change="toggleAll" />
          <span aria-hidden="true" class="text-sm text-gray-700 dark:text-gray-300">{{
            t('bulk.selectAll')
          }}</span>
        </div>
        <Oauth2ClientList
          :clients="clients"
          :selectable="selection.active.value"
          :sort="state.sort ?? 'id'"
          :order="state.order ?? 'asc'"
          @sort="(sort, order) => list.setSort(sort, order)"
        >
          <template #actions="{ client }">
            <Oauth2ClientActions :client="client" @delete="deletion.start" />
          </template>
          <template #select-all>
            <SelectCheckbox
              :label="t('bulk.selectAll')"
              :checked="allSelected"
              @change="toggleAll"
            />
          </template>
          <template #select="{ client }">
            <SelectCheckbox
              :label="t('bulk.selectItem', { name: client.clientId })"
              :checked="selection.isSelected(String(client.id))"
              :disabled="!selection.canSelect(String(client.id))"
              described-by="bulk-limit-message"
              @change="selection.toggle(String(client.id))"
            />
          </template>
        </Oauth2ClientList>
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
      @action="(id) => bulk.run(id as Oauth2BulkAction)"
      @clear="selection.clear()"
    />
    <OneTimeSecretDialog
      ref="dialog"
      :secret="bulk.secret.value?.secret ?? null"
      :title="lt('admin.oauth2_renew_secret')"
      :description="
        bulk.secret.value
          ? `${lt('admin.oauth2_client_id')}: ${bulk.secret.value.clientId}`
          : undefined
      "
      @close="bulk.nextSecret()"
    />
  </section>
</template>

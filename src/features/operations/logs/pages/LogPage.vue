<script setup lang="ts">
// A log (US3; FR-030 to FR-044 as plan "Decisions at implementation" items 5, 6, 10, 11, 12 and 18
// settle them): legacy's log tab with its name, Refresh, the log choice and `debug.log_info`, the
// quick actions "+ 100", "+ 1000", Expand All and Collapse All, the search (`datatables.search`),
// the order of the time column, the count line (`datatables.info`) and the entries as cards or a
// table. The rate-limited log adds `admin.hash_remove_info` and "Remove hash". An unknown log type
// shows "not found" with the way to the logs. Nothing refreshes on its own.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBranding } from '@/app/branding/public-config'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { useLogEntries } from '../api'
import LogEntryList from '../components/LogEntryList.vue'
import LogQuickActions from '../components/LogQuickActions.vue'
import LogsIntro from '../components/LogsIntro.vue'
import { useLogListState } from '../list-state'
import { findLogType } from '../log-types'
import { useRateLimitReset } from '../useRateLimitReset'
import { RestartIcon } from '../../icons'

const props = defineProps<{ logType: string }>()
const { t, locale } = useI18n()
const { branding } = useBranding()
const wide = useMediaQuery('(min-width: 768px)')

const type = computed(() => findLogType(props.logType))
const list = useLogListState()
const q = computed(() => list.state.value.filters.q)
const order = computed<SortOrder>(() => list.state.value.order ?? 'desc')
const log = useLogEntries(type, () => ({ q: q.value, order: order.value }))
const rateLimits = useRateLimitReset({ refresh: () => log.refresh() })

const title = computed(() =>
  type.value ? t(type.value.titleKey, { productName: branding.value.productName }) : '',
)
const hasDetails = computed(() =>
  (type.value?.columns ?? []).some(
    (column) =>
      column.detail ||
      (column.key !== 'stripe' &&
        column.key !== 'action' &&
        !type.value!.card.head.includes(column.key) &&
        column.key !== type.value!.card.body),
  ),
)

// Details opened by the entry, by Expand All or Collapse All; a new view starts closed.
const expanded = ref<ReadonlySet<string>>(new Set())
const outcome = ref('')
watch([type, q, order], () => {
  expanded.value = new Set()
  outcome.value = ''
})

function toggle(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

const number = (value: number) => formatNumber(value, locale.value as AppLocale)
const countText = computed(() =>
  log.entries.value.length === 0
    ? lt('datatables.infoEmpty')
    : lt('datatables.info', {
        _START_: number(1),
        _END_: number(log.entries.value.length),
        _TOTAL_: number(Math.max(log.total.value, log.entries.value.length)),
      }),
)

// FR-086: the count is announced once the entries of a new search have loaded.
let announcedFor = q.value ?? ''
watch(
  () => [log.loading.value, log.fetching.value] as const,
  ([loading, fetching]) => {
    const current = q.value ?? ''
    if (loading || fetching || current === announcedFor) return
    announcedFor = current
    announce(countText.value)
  },
)

async function more(size: number) {
  outcome.value = ''
  const added = await log.loadMore(size)
  if (added === null) return
  // Legacy's alerts: "100 additional rows were added", or "No further rows available".
  outcome.value =
    added === 0 ? lt('admin.no_new_rows') : `${number(added)}${lt('admin.additional_rows')}`
  announce(outcome.value)
}

function refresh() {
  outcome.value = ''
  void log.refresh()
}

const loadFailed = computed(() => log.problem.value !== null && log.entries.value.length === 0)
const updateFailed = computed(() => log.problem.value !== null && log.entries.value.length > 0)
const unavailable = computed(() => log.problem.value?.status === 503)
</script>

<template>
  <NotFoundPage
    v-if="!type"
    :back-to="{ name: 'operations-logs' }"
    :back-label="lt('debug.logs')"
  />
  <section v-else class="flex flex-col">
    <PageHeader :title="title">
      <template #actions>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :aria-disabled="log.fetching.value || undefined"
          @click="!log.fetching.value && refresh()"
        >
          <RestartIcon :class="log.fetching.value ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>
    <LogsIntro :current="type.slug" />
    <LegacyText
      v-if="type.slug === 'rate-limits'"
      k="admin.hash_remove_info"
      as="p"
      class="mb-4 text-sm text-gray-600 dark:text-gray-400"
    />

    <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <SearchField
        id="operations-log-search"
        class="md:w-96"
        :label="lt('datatables.search')"
        :model-value="q ?? ''"
        @search="(value) => list.setFilter('q', value || undefined, { typing: true })"
      />
      <div class="flex flex-wrap items-end gap-3">
        <div v-if="!wide" class="flex flex-col gap-1.5">
          <label
            for="operations-log-order"
            class="text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            {{ lt('admin.time') }}
          </label>
          <select
            id="operations-log-order"
            :value="order"
            class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            @change="list.setSort('time', ($event.target as HTMLSelectElement).value as SortOrder)"
          >
            <option value="desc">{{ t('operations.logs.sort.desc') }}</option>
            <option value="asc">{{ t('operations.logs.sort.asc') }}</option>
          </select>
        </div>
        <LogQuickActions
          :details="hasDetails"
          :busy="log.loadingMore.value"
          @more="more"
          @expand-all="expanded = new Set(log.entries.value.map((entry) => entry.id))"
          @collapse-all="expanded = new Set()"
        />
      </div>
    </div>

    <p
      v-if="outcome"
      role="status"
      data-load-outcome
      class="mb-3 text-sm text-gray-700 dark:text-gray-300"
    >
      {{ outcome }}
    </p>
    <ProblemMessage
      v-if="rateLimits.problem.value"
      class="mb-3"
      :problem="rateLimits.problem.value"
    />
    <p
      v-if="updateFailed"
      data-update-failed
      class="mb-3 flex items-start gap-2 text-sm text-warning-800 dark:text-warning-200"
    >
      <WarningIcon class="mt-0.5 size-4 shrink-0" />
      <span>{{ t('operations.live.failed') }}</span>
    </p>

    <div
      v-if="log.loading.value"
      role="status"
      aria-busy="true"
      class="py-8 text-center text-gray-600 dark:text-gray-400"
    >
      {{ lt('datatables.loadingRecords') }}
    </div>
    <div v-else-if="loadFailed" class="flex flex-col items-start gap-3" data-log-error>
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ unavailable ? t('operations.logs.unavailable') : t('states.list.error') }}
      </p>
      <ProblemMessage v-if="!unavailable" :problem="log.problem.value" />
      <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="log.retry()">
        {{ t('common.retry') }}
      </button>
    </div>
    <div
      v-else-if="log.entries.value.length === 0"
      data-log-empty
      class="flex flex-col items-center gap-3 py-8 text-center text-gray-600 dark:text-gray-400"
    >
      <p>{{ q ? lt('datatables.zeroRecords') : lt('datatables.emptyTable') }}</p>
      <button
        v-if="q"
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        @click="list.setFilter('q', undefined)"
      >
        {{ t('lists.search.clear') }}
      </button>
    </div>
    <template v-else>
      <LogEntryList
        :type="type"
        :title="title"
        :entries="log.entries.value"
        :expanded="expanded"
        :wide="wide"
        :order="order"
        @toggle="toggle"
        @reset="rateLimits.reset"
        @sort="(next) => list.setSort('time', next)"
      />
      <p data-log-count class="mt-3 text-sm text-gray-600 dark:text-gray-400">{{ countText }}</p>
    </template>
  </section>
</template>

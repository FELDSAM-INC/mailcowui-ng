<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import { useDataList } from '@/shared/composables/useDataList'

// Rspamd's scan history and statistics (US6; FR-045 to FR-049 as plan "Decisions at implementation"
// items 5, 6, 11, 12, 18 and 19 settle them): legacy's Rspamd tab with Refresh, the log choice and
// `debug.log_info`; `debug.chart_this_server` with the per-action bars; `debug.history_all_servers`
// with the scan history (search, sort, paging by the API, Expand All and Collapse All). The
// statistics and the history fail and retry separately; nothing refreshes on its own.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem } from '@/api'
import { problemOf } from '@/api'
import ListState from '@/shared/components/ListState.vue'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import type { PageSize, SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'

import LogQuickActions from '../../logs/components/LogQuickActions.vue'
import LogsIntro from '../../logs/components/LogsIntro.vue'
import { useRspamdHistory, useRspamdStatistics } from '../api'
import RspamdActionsChart from '../components/RspamdActionsChart.vue'
import RspamdHistoryList from '../components/RspamdHistoryList.vue'
import { useRspamdListState, type RspamdSort } from '../list-state'
import { RestartIcon } from '../../icons'

const { t, locale } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const list = useRspamdListState()
const state = computed(() => list.state.value)
const sort = computed<RspamdSort>(() => state.value.sort ?? 'time')
const order = computed<SortOrder>(() => state.value.order ?? 'desc')

const statistics = useRspamdStatistics()
const history = useRspamdHistory(() => ({
  ...list.paging.value,
  ...(state.value.filters.q ? { q: state.value.filters.q } : {}),
}))

const expanded = ref<ReadonlySet<string>>(new Set())
watch(
  () => JSON.stringify(state.value),
  () => {
    expanded.value = new Set()
  },
)

function toggle(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

const entries = computed(() => history.data.value?.data ?? [])
const total = computed(() => history.data.value?.meta.total ?? 0)
const fetching = computed(() => statistics.isFetching.value || history.isFetching.value)
const statisticsProblem = computed<ApiProblem | null>(() =>
  statistics.data.value ? null : problemOf(statistics.error.value),
)
const historyProblem = computed<ApiProblem | null>(() =>
  history.data.value ? null : problemOf(history.error.value),
)
const unreachable = (problem: ApiProblem | null) => problem?.status === 503

function refresh() {
  void statistics.refetch()
  void history.refetch()
}

// FR-086: the number of matching scans is announced after a search.
const number = (value: number) => formatNumber(value, locale.value as AppLocale)
let announcedFor = state.value.filters.q ?? ''
watch(
  () => [history.isFetching.value, history.isPlaceholderData.value] as const,
  ([loading, placeholder]) => {
    const current = state.value.filters.q ?? ''
    if (loading || placeholder || !history.data.value || current === announcedFor) return
    announcedFor = current
    const shown = entries.value.length
    announce(
      shown === 0
        ? lt('datatables.infoEmpty')
        : lt('datatables.info', {
            _START_: number(list.paging.value.offset + 1),
            _END_: number(list.paging.value.offset + shown),
            _TOTAL_: number(total.value),
          }),
    )
  },
)

useDataList('operations-rspamd-pages-rspamdpage')
</script>

<template>
  <section class="flex flex-col">
    <PageHeader :title="t('operations.rspamd.title')">
      <template #actions>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :aria-disabled="fetching || undefined"
          @click="!fetching && refresh()"
        >
          <RestartIcon :class="fetching ? 'motion-safe:animate-spin' : ''" />
          {{ lt('admin.refresh') }}
        </button>
      </template>
    </PageHeader>
    <LogsIntro current="rspamd" />

    <section aria-labelledby="rspamd-chart" class="mb-8 flex flex-col gap-3" data-rspamd-statistics>
      <h2 id="rspamd-chart" class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ lt('debug.chart_this_server') }}
      </h2>
      <div
        v-if="statistics.isPending.value && statistics.isFetching.value"
        role="status"
        aria-busy="true"
        class="py-4 text-gray-600 dark:text-gray-400"
      >
        {{ lt('datatables.loadingRecords') }}
      </div>
      <div v-else-if="statisticsProblem" class="flex flex-col items-start gap-3">
        <p role="alert" class="font-medium text-gray-900 dark:text-white">
          {{
            unreachable(statisticsProblem)
              ? t('operations.rspamd.unavailable')
              : t('states.list.error')
          }}
        </p>
        <ProblemMessage v-if="!unreachable(statisticsProblem)" :problem="statisticsProblem" />
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="statistics.refetch()"
        >
          {{ t('common.retry') }}
        </button>
      </div>
      <RspamdActionsChart v-else-if="statistics.data.value" :statistics="statistics.data.value" />
    </section>

    <section aria-labelledby="rspamd-history" class="flex flex-col gap-3" data-rspamd-history>
      <h2 id="rspamd-history" class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ lt('debug.history_all_servers') }}
      </h2>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <ListToolbar
          ><template #search
            ><SearchField
              id="operations-rspamd-search"
              class="md:w-96"
              :label="lt('datatables.search')"
              :model-value="state.filters.q ?? ''"
              @search="
                (value) => list.setFilter('q', value || undefined, { typing: true })
              " /></template
        ></ListToolbar>
        <div class="flex flex-wrap items-end gap-3">
          <template v-if="!wide"> </template>
          <LogQuickActions
            :more="false"
            details
            @expand-all="
              expanded = new Set(entries.map((entry, index) => `${index}-${entry.time}`))
            "
            @collapse-all="expanded = new Set()"
          />
        </div>
      </div>

      <ListState
        :loading="history.isPending.value && history.isFetching.value"
        :failed="!!historyProblem"
        :problem="unreachable(historyProblem) ? null : historyProblem"
        :empty="entries.length === 0"
        :error-attrs="{ class: 'flex flex-col items-start gap-3', 'data-history-error': '' }"
        retry-placement="separate"
        empty-layout="centered-actions"
        :no-matches="!!state.filters.q && entries.length === 0"
        :clear-label="t('lists.search.clear')"
        :no-matches-attrs="{ 'data-history-empty': '' }"
        :empty-attrs="{ 'data-history-empty': '' }"
        :error-text="
          unreachable(historyProblem) ? t('operations.rspamd.unavailable') : t('states.list.error')
        "
        @clear="list.setFilter('q', undefined)"
        @retry="history.refetch()"
      >
        <template #default>
          <RspamdHistoryList
            :entries="entries"
            :expanded="expanded"
            :wide="wide"
            :sort="sort"
            :order="order"
            @toggle="toggle"
            @sort="(next, nextOrder) => list.setSort(next, nextOrder)"
          />
          <PaginationBar
            :total="total"
            :page="state.page"
            :size="state.size"
            :page-sizes="list.pageSizes"
            @update:page="list.setPage"
            @update:size="(size) => list.setSize(size as PageSize)"
          />
        </template>
      </ListState>
    </section>
  </section>
</template>

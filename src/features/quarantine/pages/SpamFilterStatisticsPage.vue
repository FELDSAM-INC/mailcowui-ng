<script setup lang="ts">
import RefreshButton from '@/shared/components/RefreshButton.vue'

// The spam filter's action statistics (UI 006 US8, FR-065, legacy form map screen 9): the classic
// dashboard's Rspamd chart as a text table (D8), with legacy's `admin.refresh`. Nothing refreshes on
// its own. An unreachable spam filter (503) says the service is temporarily unavailable, with a
// retry.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { DangerIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import QuarantineSectionNav from '../components/QuarantineSectionNav.vue'
import ActionStatisticsList from '../components/statistics/ActionStatisticsList.vue'
import { useSpamStatistics } from '../statistics-api'

const { t } = useI18n()
const query = useSpamStatistics()
const statistics = computed(() => query.data.value ?? null)
const problem = computed(() => problemOf(query.error.value))
/** A 503 (the spam filter cannot be reached) reads as the service being unavailable. */
const unavailable = computed(
  () => !!problem.value && (problem.value.status === 503 || problem.value.kind === 'unavailable'),
)

function refresh() {
  void query.refetch()
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4">
    <QuarantineSectionNav />
    <PageHeader :title="lt('mailbox.stats')">
      <template #actions>
        <RefreshButton :pending="query.isFetching.value" @refresh="refresh" />
      </template>
    </PageHeader>

    <p
      v-if="query.isPending.value && query.isFetching.value"
      role="status"
      class="text-sm text-gray-700 dark:text-gray-300"
    >
      {{ lt('datatables.loadingRecords') }}
    </p>
    <div
      v-else-if="unavailable && !query.isFetching.value"
      role="alert"
      data-unavailable
      class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <DangerIcon class="mt-0.5 size-5 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="break-words">{{ t('problem.service-unavailable') }}</p>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline', class: 'mt-3' })"
          @click="refresh"
        >
          {{ t('common.retry') }}
        </button>
      </div>
    </div>
    <ProblemMessage
      v-else-if="problem && !statistics && !query.isFetching.value"
      :problem="problem"
      retry
      @retry="refresh"
    />
    <ActionStatisticsList v-if="statistics" :statistics="statistics" />
  </section>
</template>

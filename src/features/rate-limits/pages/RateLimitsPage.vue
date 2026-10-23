<script setup lang="ts">
// The Rate limits overview (US6, FR-056 to FR-058; no classic counterpart, legacy form map screen 7
// and D1): every limit in the caller's scope with the kind filter, the search on the object, sort
// by object or kind, pages and page size in the address; cards below md and a table from md up;
// legacy's list states (`datatables.*`). Each entry opens its object's page at the rate limit
// section. "Set a rate limit" finds an object and continues there; administrators reset a bucket
// with legacy's "Remove hash". A domain administrator without `ratelimit` reads the limits with
// legacy's "Prohibited by ACL". Mailbox users never reach the page (`meta.roles`).
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useListQueryState } from '@/shared/composables/useListQueryState'
import { useI18n } from 'vue-i18n'

import { problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import {
  QuarantineSectionNav,
  canChangeRateLimits,
  canResetBucket,
  missingFlag,
} from '@/features/quarantine'
import { lt, text } from '@/i18n'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import OutcomeAlert from '@/shared/components/OutcomeAlert.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import type { PageSize, SortOrder } from '@/shared/composables/useListState'
import { buttonVariants } from '@/shared/ui/button'

import { rateLimitListOptions, type RateLimitKind } from '../api'
import RateLimitList from '../components/RateLimitList.vue'
import ResetBucketDialog from '../components/ResetBucketDialog.vue'
import SetRateLimitDialog from '../components/SetRateLimitDialog.vue'
import type { ResetOutcome } from '../composables/useResetRateLimitBucket'
import {
  RATE_LIMIT_KINDS,
  RATE_LIMIT_SORTS,
  useRateLimitListState,
  type RateLimitSort,
} from '../list-state'

const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const identityQuery = useIdentityQuery()
const identity = computed(() => identityQuery.data.value)
const changeable = computed(() => canChangeRateLimits(identity.value))
const resettable = computed(() => canResetBucket(identity.value))
const aclFlag = computed(() => missingFlag(identity.value, 'changeRateLimits'))

const list = useRateLimitListState()
const state = computed(() => list.state.value)
const query = useQuery(computed(() => rateLimitListOptions(list.params.value)))
const items = computed(() => query.data.value?.data ?? [])
const { total, initialLoading, loadFailed, refreshFailed, empty, noMatches, listState } =
  useListQueryState(query, () => list.hasSearchOrFilters.value)

const kindLabel = (kind: RateLimitKind) => text(`enums.rateLimitObjectKind.${kind}`)
const sortLabel = (sort: RateLimitSort) =>
  sort === 'object' ? t('rateLimits.list.object') : lt('mailbox.kind')

function setKind(value: string) {
  void list.setFilter(
    'kind',
    (RATE_LIMIT_KINDS as readonly string[]).includes(value) ? (value as RateLimitKind) : undefined,
  )
}
function clearAll() {
  void list.setFilters({ q: undefined, kind: undefined })
}

const setOpen = ref(false)
const resetOpen = ref(false)
const outcome = ref<ResetOutcome | null>(null)
watch(resetOpen, (open) => {
  if (open) outcome.value = null
})

const SELECT =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
const LABEL = 'text-sm font-medium text-gray-800 dark:text-gray-200'
</script>

<template>
  <section
    class="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4"
    :data-list-state="listState"
  >
    <QuarantineSectionNav />
    <PageHeader :title="t('rateLimits.title')">
      <template #actions>
        <button
          v-if="changeable"
          type="button"
          data-set-rate-limit
          :class="buttonVariants({ variant: 'default' })"
          @click="setOpen = true"
        >
          {{ t('rateLimits.set.title') }}
        </button>
        <button
          v-if="resettable"
          type="button"
          data-reset-bucket
          :class="buttonVariants({ variant: 'outline' })"
          @click="resetOpen = true"
        >
          {{ lt('admin.reset_limit') }}
        </button>
      </template>
    </PageHeader>

    <AclReadOnlyNote v-if="!changeable && aclFlag" id="rate-limits-acl" :flag="aclFlag" />
    <OutcomeAlert
      v-if="outcome"
      :kind="outcome.kind"
      :message="outcome.message"
      @dismiss="outcome = null"
    />

    <div class="flex flex-col gap-3 md:flex-row md:items-end">
      <SearchField
        id="rate-limits-search"
        class="md:flex-1"
        :label="lt('datatables.search')"
        :model-value="state.filters.q ?? ''"
        @search="(value) => list.setFilter('q', value || undefined, { typing: true })"
      />
      <div class="flex flex-col gap-1.5">
        <label for="rate-limits-kind" :class="LABEL">{{ lt('mailbox.kind') }}</label>
        <select
          id="rate-limits-kind"
          :value="state.filters.kind ?? ''"
          :class="SELECT"
          @change="setKind(($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ t('lists.filters.all') }}</option>
          <option v-for="kind in RATE_LIMIT_KINDS" :key="kind" :value="kind">
            {{ kindLabel(kind) }}
          </option>
        </select>
      </div>
      <div v-if="!wide" class="flex flex-wrap gap-3">
        <div class="flex flex-col gap-1.5">
          <label for="rate-limits-sort" :class="LABEL">{{ t('lists.sort.label') }}</label>
          <select
            id="rate-limits-sort"
            :value="state.sort ?? 'object'"
            :class="SELECT"
            @change="
              list.setSort(
                ($event.target as HTMLSelectElement).value as RateLimitSort,
                state.order ?? 'asc',
              )
            "
          >
            <option v-for="sort in RATE_LIMIT_SORTS" :key="sort" :value="sort">
              {{ sortLabel(sort) }}
            </option>
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="rate-limits-order" :class="LABEL">{{ t('lists.sort.order') }}</label>
          <select
            id="rate-limits-order"
            :value="state.order ?? 'asc'"
            :class="SELECT"
            @change="
              list.setSort(
                state.sort ?? 'object',
                ($event.target as HTMLSelectElement).value as SortOrder,
              )
            "
          >
            <option value="asc">{{ t('lists.sort.asc') }}</option>
            <option value="desc">{{ t('lists.sort.desc') }}</option>
          </select>
        </div>
      </div>
    </div>

    <ListState
      :loading="initialLoading"
      :failed="loadFailed"
      :problem="problemOf(query.error.value)"
      :empty="empty"
      :no-matches="noMatches"
      :skeleton="24"
      empty-layout="plain"
      :refresh-failed="refreshFailed"
      :refresh-text="t('lists.refreshFailed')"
      :no-matches-attrs="{ 'data-no-matches': '' }"
      :empty-attrs="{ 'data-empty': '' }"
      :clear-label="t('lists.filters.clear')"
      @clear="clearAll"
      @retry="query.refetch()"
    >
      <template #default>
        <RateLimitList
          :items="items"
          :wide="wide"
          :sort="state.sort ?? 'object'"
          :order="state.order ?? 'asc'"
          @sort="(sort, order) => list.setSort(sort, order)"
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

    <SetRateLimitDialog v-if="changeable" v-model:open="setOpen" />
    <ResetBucketDialog v-if="resettable" v-model:open="resetOpen" @done="outcome = $event" />
  </section>
</template>

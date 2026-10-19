<script setup lang="ts">
// The caller's quarantine, with its view in the address and no automatic polling.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { isApiProblem, problemOf, type QuarantineItem } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import type { PageSize } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'

import type { OutcomeLine } from '../action-outcome'
import {
  forgetItem,
  quarantineItemOptions,
  quarantineListOptions,
  quarantineSettingsOptions,
} from '../api'
import ActionOutcomeMessage from '../components/ActionOutcomeMessage.vue'
import QuarantineFilters from '../components/list/QuarantineFilters.vue'
import QuarantineItemList from '../components/list/QuarantineItemList.vue'
import QuarantineSortControl from '../components/list/QuarantineSortControl.vue'
import QuarantineSectionNav from '../components/QuarantineSectionNav.vue'
import QuarantineStatusNotice from '../components/QuarantineStatusNotice.vue'
import { useItemAction, type RereadResult } from '../composables/useItemAction'
import { takeQuarantineFlash } from '../flash'
import { NO_FILTERS, useQuarantineListState } from '../list-state'
import { canActOnItems, missingFlag } from '../permissions'

const { t } = useI18n()
const fmt = useFormat()
const client = useQueryClient()
const wide = useMediaQuery('(min-width: 768px)')
const identity = useIdentityQuery()
const scoped = computed(() => !!identity.data.value && identity.data.value.role !== 'mailboxUser')
const canRemove = computed(() => canActOnItems(identity.data.value))
const aclFlag = computed(() => missingFlag(identity.data.value, 'actOnItems'))
const list = useQuarantineListState({ scoped })
const state = computed(() => list.state.value)
const query = useQuery(
  computed(() => ({ ...quarantineListOptions(list.params.value), enabled: !!identity.data.value })),
)
const settings = useQuery(quarantineSettingsOptions())
const items = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const flash = shallowRef(takeQuarantineFlash())
const selected = shallowRef<QuarantineItem>()
const asking = ref(false)

function finish(lines: OutcomeLine[]) {
  flash.value = lines
  selected.value = undefined
}
async function reread(): Promise<RereadResult> {
  if (!selected.value) return 'gone'
  try {
    selected.value = await client.fetchQuery({
      ...quarantineItemOptions(selected.value.id),
      staleTime: 0,
    })
    await query.refetch()
    return 'present'
  } catch (error) {
    return isApiProblem(error) && error.status === 404 ? 'gone' : 'failed'
  }
}
const action = useItemAction({
  item: () => selected.value,
  reread,
  onFinished: finish,
  onGone(lines) {
    if (selected.value) void forgetItem(client, selected.value.id)
    finish(lines)
  },
})
const busy = computed(() => asking.value || action.sending.value || action.waiting.value)
async function remove(item: QuarantineItem) {
  if (!canRemove.value || busy.value) return
  asking.value = true
  selected.value = item
  flash.value = []
  try {
    await action.run('delete')
  } finally {
    asking.value = false
  }
}
function clearAll() {
  void list.setFilters({ ...NO_FILTERS, action: [] })
}
function announceCount() {
  if (!query.data.value) return
  const start = total.value === 0 ? 0 : (state.value.page - 1) * state.value.size + 1
  announce(
    total.value === 0
      ? lt('datatables.infoEmpty')
      : lt('datatables.info', {
          _START_: fmt.number(start),
          _END_: fmt.number(Math.min(total.value, state.value.page * state.value.size)),
          _TOTAL_: fmt.number(total.value),
        }),
  )
}
watch(() => query.dataUpdatedAt.value, announceCount)
watch([total, () => state.value.page, () => query.isSuccess.value], ([count, page, success]) => {
  const last = Math.max(1, Math.ceil(count / state.value.size))
  if (success && page > last) void list.setPage(last)
})
async function refresh() {
  await query.refetch()
  announceCount()
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4">
    <QuarantineSectionNav />
    <PageHeader :title="lt('quarantine.quarantine')">
      <template #actions>
        <span
          v-if="query.data.value"
          class="self-center tabular-nums text-gray-800 dark:text-gray-200"
          >{{ fmt.number(total) }}</span
        >
        <button
          type="button"
          :disabled="query.isFetching.value"
          :class="buttonVariants({ variant: 'outline' })"
          @click="refresh"
        >
          {{ lt('quarantine.refresh') }}
        </button>
      </template>
    </PageHeader>
    <ProblemMessage
      v-if="settings.isError.value"
      :problem="problemOf(settings.error.value)"
      retry
      @retry="settings.refetch()"
    />
    <QuarantineStatusNotice :settings="settings.data.value ?? null" />
    <AclReadOnlyNote v-if="!canRemove && aclFlag" id="quarantine-actions-acl" :flag="aclFlag" />
    <ActionOutcomeMessage :lines="flash" @dismiss="flash = []" />
    <ActionOutcomeMessage :lines="action.lines.value" @dismiss="action.dismiss" />
    <button
      v-if="action.retryKind.value"
      type="button"
      :disabled="busy"
      :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
      @click="action.retry"
    >
      {{ t('common.retry') }}
    </button>
    <SearchField
      id="quarantine-search"
      :label="lt('datatables.search')"
      :model-value="state.filters.q ?? ''"
      @search="list.setFilter('q', $event || undefined, { typing: true })"
    />
    <QuarantineFilters :filters="state.filters" :scoped="scoped" @apply="list.setFilters" />
    <QuarantineSortControl
      v-if="!wide"
      :sort="state.sort ?? 'arrivedAt'"
      :order="state.order ?? 'desc'"
      @change="list.setSort"
    />
    <p
      v-if="query.isError.value && query.data.value"
      role="alert"
      class="text-amber-900 dark:text-amber-100"
    >
      {{ t('lists.refreshFailed') }}
    </p>
    <ListState
      :loading="query.isPending.value"
      :empty="items.length === 0"
      :problem="query.data.value ? null : problemOf(query.error.value)"
      @retry="query.refetch()"
    >
      <template #empty>
        <div
          v-if="list.hasSearchOrFilters.value"
          data-no-matches
          class="flex flex-col items-start gap-3"
        >
          <p>{{ lt('datatables.zeroRecords') }}</p>
          <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clearAll">
            {{ t('lists.filters.clear') }}
          </button>
        </div>
        <p v-else data-empty>{{ lt('datatables.emptyTable') }}</p>
      </template>
      <QuarantineItemList
        :items="items"
        :scoped="scoped"
        :sort="state.sort ?? 'arrivedAt'"
        :order="state.order ?? 'desc'"
        :can-remove="canRemove"
        :busy="busy"
        @sort="list.setSort"
        @remove="remove"
      />
    </ListState>
    <PaginationBar
      v-if="query.data.value"
      :total="total"
      :page="state.page"
      :size="state.size"
      :page-sizes="list.pageSizes"
      @update:page="list.setPage"
      @update:size="list.setSize($event as PageSize)"
    />
  </section>
</template>

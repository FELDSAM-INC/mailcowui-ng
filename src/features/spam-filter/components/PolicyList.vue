<script setup lang="ts">
// One allow or block list of an owner (UI 006 FR-045 to FR-050, US4-AS6 to US4-AS9, US5; legacy
// form map screen 5 and D16): legacy's heading and description (with its markup), the add field
// and "Add item", the search, one table of the own entries followed by the entries shown read-only,
// under one paging, sorted by rule or creation date (`<list>Q`, `<list>Sort`, … in the address), the
// loading, empty, no-match and error states with legacy's texts, and the removal of the selected own
// entries with legacy's confirmation (the number typed for several). Outcomes are legacy's alerts:
// one for an added entry, one for a single removal; several removals list one result per entry with
// "Retry the failed ones". Without the right to change the list, legacy's "Prohibited by ACL" note
// stands in for the controls.
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type PermissionFlags, type SpamPolicyEntry, type SpamPolicyList } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { canReadPolicy, useQuarantineCapabilities } from '@/features/quarantine'
import { lt, type LegacyKey } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import { useProblemMessages } from '@/i18n/problems'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import type { BulkRow } from '@/shared/components/bulk-row'
import LegacyText from '@/shared/components/LegacyText.vue'
import OutcomeAlert from '@/shared/components/OutcomeAlert.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import type { PageSize, SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { deleteEntry, entryListOptions, invalidateEntries } from '../api'
import { useRemoveEntries } from '../composables/useRemoveEntries'
import { pageRequests, usePolicyListState, type PolicySort } from '../lists-state'
import { CREATED_KEY, hostLocation, REMOVED_KEY, type PolicyOwner } from '../owner'
import PolicyEntries from './PolicyEntries.vue'
import PolicyEntryAddForm from './PolicyEntryAddForm.vue'
import RemoveEntriesConfirm from './RemoveEntriesConfirm.vue'

const props = withDefaults(
  defineProps<{
    owner: PolicyOwner
    list: SpamPolicyList
    canChange: boolean
    /** The flag whose absence makes the list read-only, for the ACL note. */
    deniedBy?: keyof PermissionFlags | null
    headingLevel?: 2 | 3
  }>(),
  { deniedBy: null, headingLevel: 2 },
)
const emit = defineEmits<{ total: [count: number | undefined] }>()

const { t, locale } = useI18n()
const { problemMessage } = useProblemMessages()
const client = useQueryClient()
const identity = useIdentityQuery()
const capabilities = useQuarantineCapabilities()
const wide = useMediaQuery('(min-width: 768px)')

const uid = `${props.list}-${useId()}`
const headingId = `${uid}-title`
const limitId = `${uid}-limit`
const HEADING: Record<SpamPolicyList, LegacyKey> = {
  allow: 'user.spamfilter_wl',
  block: 'user.spamfilter_bl',
}
const DESCRIPTION: Record<SpamPolicyList, LegacyKey> = {
  allow: 'user.spamfilter_wl_desc',
  block: 'user.spamfilter_bl_desc',
}
const number = (value: number) => formatNumber(value, locale.value as AppLocale)

const selection = useBulkSelection({ limit: () => capabilities.data.value?.bulkLimit })
const listState = usePolicyListState(props.list, { onReset: () => selection.clear() })
const state = computed(() => listState.state.value)

// The own entries of the page, then the read-only ones that follow them (an alias domain has none).
const ownQuery = useQuery(
  computed(() => ({
    ...entryListOptions(props.owner, pageRequests(props.list, state.value, undefined).own),
    placeholderData: keepPreviousData,
  })),
)
const ownTotal = computed(() => ownQuery.data.value?.meta.total)
const hasInherited = computed(() => props.owner.kind !== 'aliasDomain')
const inheritedRequest = computed(() =>
  hasInherited.value ? pageRequests(props.list, state.value, ownTotal.value).inherited : null,
)
const inheritedQuery = useQuery(
  computed(() => ({
    ...entryListOptions(
      props.owner,
      inheritedRequest.value ?? { list: props.list, ownership: 'inherited' },
    ),
    enabled: inheritedRequest.value !== null,
    placeholderData: keepPreviousData,
  })),
)

const ownRows = computed(() => ownQuery.data.value?.data ?? [])
const entries = computed<SpamPolicyEntry[]>(() => {
  const own = ownRows.value
  const room = Math.max(0, state.value.size - own.length)
  return [...own, ...(inheritedQuery.data.value?.data ?? []).slice(0, room)]
})
const total = computed(() => {
  if (ownTotal.value === undefined) return undefined
  if (!hasInherited.value) return ownTotal.value
  const inherited = inheritedQuery.data.value?.meta.total
  return inherited === undefined ? undefined : ownTotal.value + inherited
})
watch(total, (value) => emit('total', value), { immediate: true })

const loading = computed(
  () => ownQuery.isPending.value || (hasInherited.value && inheritedQuery.isPending.value),
)
const failure = computed(
  () =>
    (ownQuery.isError.value ? ownQuery.error.value : null) ??
    (inheritedQuery.isError.value ? inheritedQuery.error.value : null),
)
const loadFailed = computed(() => !!failure.value && entries.value.length === 0)
const searching = computed(() => !!state.value.filters.q)
const empty = computed(() => !loading.value && !loadFailed.value && total.value === 0)

function retry() {
  void ownQuery.refetch()
  if (hasInherited.value) void inheritedQuery.refetch()
}

// The result count is announced after a search, without moving the focus.
let announcedFor = state.value.filters.q
watch(
  () => [total.value, ownQuery.isPlaceholderData.value] as const,
  ([count, placeholder]) => {
    if (count === undefined || placeholder || state.value.filters.q === announcedFor) return
    announcedFor = state.value.filters.q
    const from = count === 0 ? 0 : (state.value.page - 1) * state.value.size + 1
    announce(
      count === 0
        ? lt('datatables.infoEmpty')
        : lt('datatables.info', {
            _START_: number(from),
            _END_: number(Math.min(count, state.value.page * state.value.size)),
            _TOTAL_: number(count),
          }),
    )
  },
)

/** An inherited entry's owner links to its page for administrators and domain administrators. */
function ownerLink(entry: SpamPolicyEntry) {
  const who = identity.data.value
  if (entry.own || who?.role === 'mailboxUser' || !canReadPolicy(who, entry.owner.kind)) {
    return null
  }
  return hostLocation({ kind: entry.owner.kind, name: entry.owner.name })
}

// Outcomes: legacy's alert for an addition or a single removal.
const outcome = ref<{ id: number; kind: 'success' | 'danger'; message: string } | null>(null)
let outcomes = 0
function report(kind: 'success' | 'danger', message: string) {
  outcomes += 1
  outcome.value = { id: outcomes, kind, message }
}

function added() {
  removal.close()
  report('success', lt(CREATED_KEY[props.owner.kind], props.owner.name))
}

const removal = useRemoveEntries({
  remove: (entry) => deleteEntry(client, props.owner, entry),
  finished: () => invalidateEntries(client, props.owner),
})

function toggleAll(checked: boolean) {
  if (checked) selection.selectPage(ownRows.value.map((entry) => String(entry.id)))
  else selection.clear()
}

const selected = computed(() =>
  ownRows.value.filter((entry) => selection.isSelected(String(entry.id))),
)

async function removeSelected() {
  const chosen = selected.value
  if (chosen.length === 0) return
  const confirmed = await confirm({
    title: lt('footer.confirm_delete'),
    description: lt('footer.delete_these_items'),
    content: { component: RemoveEntriesConfirm, props: { entries: chosen } },
    confirmLabel: lt('footer.delete_now'),
    cancelLabel: lt('footer.cancel'),
    destructive: true,
    ...(chosen.length > 1
      ? {
          requireTyped: {
            accepted: [String(chosen.length)],
            labelKey: 'bulk.confirm.typeCount',
            labelParams: { count: chosen.length },
          },
        }
      : {}),
  })
  if (!confirmed) return
  outcome.value = null
  const rows = await removal.run(chosen)
  selection.keep(removal.failedIds.value)
  if (rows.length === 1 && rows[0]!.outcome === 'done') {
    removal.close()
    report('success', lt(REMOVED_KEY[props.owner.kind], rows[0]!.id))
  }
}

async function retryFailed() {
  await removal.retry()
  selection.keep(removal.failedIds.value)
}

/** Each removed entry's line is legacy's message; a failure says why. */
function rowMessage(row: BulkRow): string | null {
  if (row.outcome === 'done') return lt(REMOVED_KEY[props.owner.kind], row.id)
  if (row.outcome === 'notFound' || !row.problem) return null
  return problemMessage(row.problem)
}

const limitMessage = computed(() =>
  selection.limitReached.value && selection.limit.value !== null
    ? t('bulk.limitReached', { max: number(selection.limit.value) })
    : null,
)
const SELECT =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <section
    :aria-labelledby="headingId"
    :data-policy-list="list"
    :aria-busy="removal.phase.value === 'running' ? 'true' : undefined"
    class="flex min-w-0 flex-col gap-3"
  >
    <component
      :is="`h${headingLevel}`"
      :id="headingId"
      class="font-semibold text-gray-900 dark:text-white"
      :class="headingLevel === 2 ? 'text-lg' : 'text-base'"
    >
      {{ lt(HEADING[list]) }}
    </component>
    <LegacyText
      :k="DESCRIPTION[list]"
      as="p"
      class="text-sm break-words text-gray-700 dark:text-gray-300"
    />

    <PolicyEntryAddForm
      v-if="canChange"
      :owner="owner"
      :list="list"
      :rules="capabilities.data.value?.senderPattern"
      :heading-id="headingId"
      :input-id="`${uid}-pattern`"
      @added="added"
    />
    <AclReadOnlyNote v-else-if="deniedBy" :id="`${uid}-acl`" :flag="deniedBy" />

    <OutcomeAlert
      v-if="outcome"
      :key="outcome.id"
      :kind="outcome.kind"
      :message="outcome.message"
      @dismiss="outcome = null"
    />

    <SearchField
      :id="`${uid}-search`"
      :label="lt('datatables.search')"
      :model-value="state.filters.q ?? ''"
      @search="(value) => listState.setFilter('q', value || undefined, { typing: true })"
    />
    <div v-if="!wide" class="flex flex-wrap gap-3">
      <div class="flex flex-col gap-1.5">
        <label :for="`${uid}-sort`" class="text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ t('lists.sort.label') }}
        </label>
        <select
          :id="`${uid}-sort`"
          :value="state.sort"
          :class="SELECT"
          @change="listState.setSort(($event.target as HTMLSelectElement).value as PolicySort)"
        >
          <option value="pattern">{{ lt('user.spamfilter_table_rule') }}</option>
          <option value="createdAt">{{ lt('user.created_on') }}</option>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <label :for="`${uid}-order`" class="text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ t('lists.sort.order') }}
        </label>
        <select
          :id="`${uid}-order`"
          :value="state.order"
          :class="SELECT"
          @change="
            listState.setSort(
              state.sort ?? 'pattern',
              ($event.target as HTMLSelectElement).value as SortOrder,
            )
          "
        >
          <option value="asc">{{ t('lists.sort.asc') }}</option>
          <option value="desc">{{ t('lists.sort.desc') }}</option>
        </select>
      </div>
    </div>

    <div
      v-if="removal.phase.value === 'running'"
      data-remove-progress
      role="status"
      class="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-800 dark:border-gray-800 dark:text-gray-200"
    >
      <SyncIcon class="size-5 motion-safe:animate-spin" />
      {{ t('bulk.progress', { count: number(selected.length) }) }}
    </div>
    <BulkResultSummary
      v-else-if="removal.phase.value === 'results' && removal.rows.value.length > 0"
      data-remove-results
      :rows="removal.rows.value"
      :message="rowMessage"
      @retry="retryFailed"
      @refresh="retry"
      @close="removal.close()"
    />

    <p
      v-if="loading && entries.length === 0"
      data-list-loading
      role="status"
      aria-busy="true"
      class="py-4 text-sm text-gray-600 dark:text-gray-400"
    >
      {{ lt('datatables.loadingRecords') }}
    </p>
    <div v-else-if="loadFailed" data-list-error class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('states.list.error') }}
      </p>
      <ProblemMessage :problem="problemOf(failure)" retry @retry="retry" />
    </div>
    <div
      v-else-if="empty && searching"
      data-empty="noMatch"
      class="flex flex-col items-start gap-3 py-2"
    >
      <p class="text-sm text-gray-700 dark:text-gray-300">{{ lt('datatables.zeroRecords') }}</p>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        @click="listState.setFilter('q', undefined)"
      >
        {{ t('lists.search.clear') }}
      </button>
    </div>
    <p v-else-if="empty" data-empty="none" class="py-2 text-sm text-gray-700 dark:text-gray-300">
      {{ lt('datatables.emptyTable') }}
    </p>
    <template v-else>
      <ProblemMessage v-if="failure" :problem="problemOf(failure)" retry @retry="retry" />
      <PolicyEntries
        :list="list"
        :entries="entries"
        :sort="state.sort ?? 'pattern'"
        :order="state.order ?? 'asc'"
        :selectable="canChange"
        :is-selected="selection.isSelected"
        :can-select="selection.canSelect"
        :owner-link="ownerLink"
        :limit-id="limitId"
        @toggle="selection.toggle"
        @toggle-all="toggleAll"
        @sort="(sort, order) => listState.setSort(sort, order)"
      />
      <div v-if="canChange && ownRows.length > 0" class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-remove-selected
            :class="buttonVariants({ variant: 'destructive' })"
            :disabled="selection.count.value === 0 || removal.phase.value === 'running'"
            @click="removeSelected"
          >
            {{ lt('mailbox.remove') }}
          </button>
          <span
            v-if="selection.count.value > 0"
            aria-live="polite"
            class="text-sm text-gray-700 dark:text-gray-300"
            >{{ t('bulk.selected', { count: number(selection.count.value) }) }}</span
          >
        </div>
        <p v-if="limitMessage" :id="limitId" class="text-sm text-gray-700 dark:text-gray-300">
          {{ limitMessage }}
        </p>
      </div>
      <PaginationBar
        v-if="total !== undefined"
        :total="total"
        :page="state.page"
        :size="state.size"
        :page-sizes="listState.pageSizes"
        @update:page="listState.setPage"
        @update:size="(size) => listState.setSize(size as PageSize)"
      />
    </template>
  </section>
</template>

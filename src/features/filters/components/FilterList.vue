<script setup lang="ts">
import { useDataList } from '@/shared/composables/useDataList'

import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { isApiProblem, problemOf, type SieveFilter } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { MailboxContextHeader } from '@/features/account'
import { lt } from '@/i18n'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { usePerItemRunner } from '@/shared/composables/usePerItemRunner'
import { useSelfServiceCapabilities } from '@/shared/composables/useSelfServiceCapabilities'
import { buttonVariants } from '@/shared/ui/button'
import { deleteFilter, updateFilter, useFilters } from '../api'
import { useFilterListState } from '../list-state'
import FilterCard from './FilterCard.vue'
import FilterDeleteList from './FilterDeleteList.vue'
import FilterFilters from './FilterFilters.vue'
import FilterTable from './FilterTable.vue'

const props = withDefaults(defineProps<{ mailbox?: string }>(), { mailbox: '' })
const { t, n } = useI18n()
const client = useQueryClient()
const identity = useIdentityQuery()
const capabilities = useSelfServiceCapabilities()
const canChange = computed(
  () =>
    identity.data.value?.role === 'admin' ||
    (identity.data.value?.role === 'domainAdmin' && identity.data.value.permissions.filters),
)
const selection = useBulkSelection({ limit: () => capabilities.data.value?.bulkLimit })
const list = useFilterListState({ onReset: selection.clear })
const query = useFilters(list.params, () => props.mailbox)
const rows = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const wide = useMediaQuery('(min-width: 768px)')
const notFound = computed(() => isApiProblem(query.error.value) && query.error.value.status === 404)
const runner = usePerItemRunner()
useLeaveGuard(() => runner.running.value, 'domains.bulk.leaveRunning')
type Action = 'activate' | 'deactivate' | 'prefilter' | 'postfilter' | 'remove'
const lastAction = ref<Action>('remove')
const outcomeMailboxes = ref<Record<string, string>>({})
let disposed = false
onScopeDispose(() => {
  disposed = true
})
function location(item?: SieveFilter) {
  return {
    name: `${props.mailbox ? 'mailbox-' : ''}filter-${item ? 'detail' : 'create'}`,
    params: {
      ...(props.mailbox ? { address: props.mailbox } : {}),
      ...(item ? { filterId: item.id } : {}),
    },
  }
}
const actions = computed(() => [
  { id: 'activate', label: lt('mailbox.activate') },
  { id: 'deactivate', label: lt('mailbox.deactivate') },
  { id: 'prefilter', label: lt('mailbox.set_prefilter') },
  { id: 'postfilter', label: lt('mailbox.set_postfilter') },
  { id: 'remove', label: lt('mailbox.remove'), destructive: true },
])
const selected = computed(() => rows.value.filter((item) => selection.isSelected(String(item.id))))
function toggleAll() {
  const ids = rows.value.map((item) => String(item.id))
  if (selection.allSelected(ids)) selection.clear()
  else selection.selectPage(ids)
}
async function run(action: Action, items = selected.value) {
  if (!canChange.value || runner.running.value || !items.length) return
  const owner = props.mailbox
  if (
    action === 'remove' &&
    !(await confirm({
      title: lt('footer.confirm_delete'),
      content: {
        component: FilterDeleteList,
        props: { names: items.map((item) => `${item.description} (${item.mailbox})`) },
      },
      confirmLabel: lt('footer.delete_now'),
      destructive: true,
      ...(items.length > 1
        ? {
            requireTyped: {
              accepted: [String(items.length)],
              labelKey: 'bulk.confirm.typeCount',
              labelParams: { count: items.length },
            },
          }
        : {}),
    }))
  )
    return
  if (disposed || owner !== props.mailbox || !canChange.value || runner.running.value) return
  runner.clear()
  outcomeMailboxes.value = Object.fromEntries(items.map((item) => [String(item.id), item.mailbox]))
  lastAction.value = action
  await runner.run(
    items.map((item) => ({
      ...item,
      id: String(item.id),
      label: `${item.description} (${item.mailbox})`,
    })),
    (item) => {
      const filter = { ...item, id: Number(item.id) }
      return action === 'remove'
        ? deleteFilter(client, filter)
        : updateFilter(
            client,
            filter,
            action === 'activate' || action === 'deactivate'
              ? { active: action === 'activate' }
              : { kind: action },
          )
    },
  )
  if (disposed || owner !== props.mailbox) return
  selection.keep(
    runner.rows.value
      .filter((row) => ['failed', 'refused', 'outdated', 'notProcessed'].includes(row.outcome))
      .map((row) => row.id),
  )
  await query.refetch()
}
watch(canChange, (allowed) => {
  if (!allowed) selection.leave()
})
watch([total, () => list.state.value.page], ([count, page]) => {
  if (count > 0 && (page - 1) * list.state.value.size >= count)
    void list.setPage(Math.ceil(count / list.state.value.size))
})

useDataList('sieve-filters', () => ({
  key: list.state.value.sort,
  order: list.state.value.order ?? 'asc',
  change: (key, order) =>
    void list.setSort(key as NonNullable<typeof list.state.value.sort>, order),
}))
</script>
<template>
  <NotFoundPage v-if="notFound" />
  <section v-else class="flex min-w-0 flex-col gap-5">
    <component
      :is="mailbox ? MailboxContextHeader : PageHeader"
      :title="lt('mailbox.filters')"
      v-bind="mailbox ? { targetType: 'sieveFilter' } : {}"
    >
      <template #actions
        ><RouterLink v-if="canChange" :to="location()" :class="buttonVariants({})">{{
          lt('mailbox.add_filter')
        }}</RouterLink></template
      >
    </component>
    <AclReadOnlyNote v-if="!canChange && !mailbox" id="filters-read-only" flag="filters" />
    <LegacyText k="mailbox.sieve_info" as="p" class="text-sm text-gray-700 dark:text-gray-300" />
    <FilterFilters :list="list" :mailbox-context="!!mailbox"
      ><template #select
        ><button
          v-if="canChange"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="runner.running.value"
          @click="selection.active.value ? selection.leave() : selection.enter()"
        >
          {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
        </button></template
      ></FilterFilters
    >
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="query.isFetching.value"
        @click="query.refetch()"
      >
        {{ lt('admin.refresh') }}
      </button>

      <button
        v-if="selection.active.value"
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="runner.running.value"
        @click="toggleAll"
      >
        {{ lt('mailbox.toggle_all') }}
      </button>
    </div>
    <p
      v-if="selection.limitReached.value && selection.limit.value !== null"
      role="status"
      class="text-sm text-gray-700 dark:text-gray-300"
    >
      {{ t('bulk.limitReached', { max: n(selection.limit.value) }) }}
    </p>
    <BulkResultSummary
      v-if="runner.rows.value.length"
      :rows="runner.rows.value"
      :message="
        (row) =>
          row.outcome === 'done'
            ? lastAction === 'remove'
              ? lt('success.delete_filter', row.id)
              : lt('success.mailbox_modified', outcomeMailboxes[row.id] ?? '')
            : null
      "
      @close="runner.clear"
      @retry="run(lastAction)"
      @refresh="query.refetch()"
    />
    <p v-if="query.isPending.value" role="status" aria-busy="true">
      {{ lt('datatables.loadingRecords') }}
    </p>
    <ProblemMessage
      v-else-if="query.isError.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <p v-else-if="!rows.length" role="status">
      {{ lt(list.activeFilters.value.length ? 'datatables.zeroRecords' : 'datatables.emptyTable') }}
    </p>
    <FilterTable
      v-else
      :hidden="!wide"
      :items="rows"
      :location="location"
      :selecting="selection.active.value"
      :selected="selection.isSelected"
      :can-change="!!canChange"
      :busy="runner.running.value"
      :can-select="selection.canSelect"
      @toggle="selection.toggle"
      @remove="run('remove', [$event])"
    />
    <ul v-if="!wide" class="flex min-w-0 flex-col gap-3" data-filter-list>
      <li v-for="item in rows" :key="item.id" :data-filter-id="item.id">
        <FilterCard
          :item="item"
          :location="location(item)"
          :selecting="selection.active.value"
          :selected="selection.isSelected(String(item.id))"
          :can-change="!!canChange"
          :busy="runner.running.value || !selection.canSelect(String(item.id))"
          @toggle="selection.toggle(String(item.id))"
          @remove="run('remove', [item])"
        />
      </li>
    </ul>
    <PaginationBar
      :total="total"
      :page="list.state.value.page"
      :size="list.state.value.size"
      @update:page="list.setPage"
      @update:size="list.setSize($event as 25 | 50 | 100)"
    />
    <BulkActionBar
      v-if="selection.active.value"
      :count="selection.count.value"
      :actions="actions"
      :busy="runner.running.value"
      @action="run($event as Action)"
      @clear="selection.clear"
    />
  </section>
</template>

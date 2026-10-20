<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiProblem, problemOf, type TemporaryAlias } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import type { BulkRow } from '@/shared/components/bulk-row'
import MailboxContextHeader from '../components/layout/MailboxContextHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { usePerItemRunner } from '@/shared/composables/usePerItemRunner'
import { buttonVariants } from '@/shared/ui/button'
import {
  deleteTemporaryAlias,
  updateTemporaryAlias,
  useTemporaryAliases,
} from '../api/temporary-aliases'
import AppPasswordDeleteList from '../components/app-passwords/AppPasswordDeleteList.vue'
import GenerateAliasPanel from '../components/temporary-aliases/GenerateAliasPanel.vue'
import TemporaryAliasList from '../components/temporary-aliases/TemporaryAliasList.vue'
import ValidityActions from '../components/temporary-aliases/ValidityActions.vue'
import { useSectionAccess } from '../composables/useSectionAccess'
import { useTemporaryAliasListState, type TemporaryAliasSort } from '../list-state'
import { validityPatch, type AliasValidity } from '../validity'

const { t } = useI18n()
const client = useQueryClient()
const access = useSectionAccess(() => 'temporaryAliases')
const mailbox = access.context.mailbox
const selection = useBulkSelection()
const list = useTemporaryAliasListState({ onReset: selection.clear })
const query = useTemporaryAliases(mailbox, list.params)
const rows = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const limits = computed(() => access.capabilities.data.value?.temporaryAliases)
const selected = computed(() => rows.value.filter((item) => selection.isSelected(item.address)))
const selectedIds = computed(() => selected.value.map((item) => item.address))
const notFound = computed(() => isApiProblem(query.error.value) && query.error.value.status === 404)
const runner = usePerItemRunner()
let disposed = false
let contextGeneration = 0
onScopeDispose(() => {
  disposed = true
})
watch(mailbox, () => {
  contextGeneration++
  selection.leave()
  runner.clear()
})
watch(
  () => access.canChange.value,
  (allowed) => {
    if (!allowed) selection.leave()
  },
)
useLeaveGuard(() => runner.running.value, 'domains.bulk.leaveRunning')
const lastAction = ref<AliasValidity | 'remove'>('remove')
function outcomeMessage(row: BulkRow): string | null {
  if (row.outcome === 'done') return lt('success.mailbox_modified', mailbox.value)
  if (row.problem?.fieldErrors.get('lifetimeHours')?.some((error) => error.code === 'outOfRange'))
    return lt('danger.validity_missing')
  return null
}
const sortLabels = {
  expiresAt: 'user.alias_valid_until',
  createdAt: 'user.created_on',
  address: 'user.alias',
} as const
function toggleAll() {
  const ids = rows.value.map((item) => item.address)
  if (selection.allSelected(ids)) selection.clear()
  else selection.selectPage(ids)
}
async function run(action: AliasValidity | 'remove', items = selected.value) {
  if (!access.canChange.value || runner.running.value || !items.length) return
  const owner = mailbox.value
  const generation = contextGeneration
  const current = () => !disposed && owner === mailbox.value && generation === contextGeneration
  if (
    action === 'remove' &&
    !(await confirm({
      title: lt('footer.confirm_delete'),
      content: {
        component: AppPasswordDeleteList,
        props: { names: items.map((item) => item.address) },
      },
      ...(items.length > 1
        ? {
            requireTyped: {
              accepted: [String(items.length)],
              labelKey: 'bulk.confirm.typeCount',
              labelParams: { count: items.length },
            },
          }
        : {}),
      confirmLabel: lt('footer.delete_now'),
      destructive: true,
    }))
  )
    return
  if (!current() || !access.canChange.value || runner.running.value) return
  lastAction.value = action
  const outcomes = await runner.run(
    items.map((item) => ({ ...item, id: item.address, label: item.address })),
    (item) =>
      action === 'remove'
        ? deleteTemporaryAlias(client, owner, item.address, item.etag)
        : updateTemporaryAlias(client, owner, item.address, validityPatch(action), item.etag),
  )
  if (!current()) {
    runner.clear()
    return
  }
  // Unknown writes are never retried; the result asks for a refresh instead.
  selection.keep(
    outcomes
      .filter((row) => ['failed', 'refused', 'outdated', 'notProcessed'].includes(row.outcome))
      .map((row) => row.id),
  )
  await query.refetch()
}
watch([total, () => list.state.value.page], ([count, page]) => {
  if (count > 0 && (page - 1) * list.state.value.size >= count)
    void list.setPage(Math.max(1, Math.ceil(count / list.state.value.size)))
})
function created(_item: TemporaryAlias) {
  // Make a generated address visible even when previous filters would hide it.
  void list.setFilters({ q: undefined, permanent: undefined })
}
</script>
<template>
  <NotFoundPage v-if="notFound" />
  <section v-else class="flex flex-col gap-5">
    <MailboxContextHeader :title="lt('user.spam_aliases')" />
    <SanitizedHtml :html="lt('user.spam_aliases_info')" class="text-gray-700 dark:text-gray-300" />
    <details v-if="access.canChange.value" class="surface">
      <summary
        class="flex min-h-11 cursor-pointer items-center font-semibold text-gray-900 dark:text-white"
      >
        {{ lt('user.alias_create_random') }}
      </summary>
      <GenerateAliasPanel
        :key="mailbox"
        :mailbox="mailbox"
        :can-change="access.canChange.value"
        class="mt-4"
        @created="created"
      />
    </details>
    <SearchField
      id="temporary-alias-search"
      :model-value="list.state.value.filters.q ?? ''"
      :label="lt('datatables.search')"
      @search="list.setFilter('q', $event || undefined, { typing: true })"
    />
    <div class="flex flex-wrap gap-3">
      <label class="flex min-h-11 flex-col gap-1 text-sm text-gray-800 dark:text-gray-200"
        >{{ lt('user.forever') }}
        <select
          class="form-control"
          :value="list.state.value.filters.permanent ?? ''"
          @change="
            list.setFilter(
              'permanent',
              (($event.target as HTMLSelectElement).value || undefined) as
                'true' | 'false' | undefined,
            )
          "
        >
          <option value="">{{ t('lists.filters.all') }}</option>
          <option value="true">{{ t('lists.filters.yes') }}</option>
          <option value="false">{{ t('lists.filters.no') }}</option>
        </select>
      </label>
      <label class="flex min-h-11 flex-col gap-1 text-sm text-gray-800 dark:text-gray-200"
        >{{ t('lists.sort.label') }}
        <select
          class="form-control"
          :value="list.state.value.sort"
          @change="list.setSort(($event.target as HTMLSelectElement).value as TemporaryAliasSort)"
        >
          <option v-for="(label, sort) in sortLabels" :key="sort" :value="sort">
            {{ lt(label) }}
          </option>
        </select>
      </label>
      <button
        type="button"
        class="self-end"
        :class="buttonVariants({ variant: 'outline' })"
        @click="
          list.setSort(
            list.state.value.sort ?? 'expiresAt',
            list.state.value.order === 'asc' ? 'desc' : 'asc',
          )
        "
      >
        {{ t(list.state.value.order === 'asc' ? 'lists.sort.asc' : 'lists.sort.desc') }}
      </button>
    </div>
    <div v-if="access.canChange.value" class="flex flex-wrap gap-2">
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="runner.running.value"
        @click="selection.active.value ? selection.leave() : selection.enter()"
      >
        {{ t(selection.active.value ? 'bulk.exitSelection' : 'bulk.select') }}
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
    <BulkResultSummary
      v-if="runner.rows.value.length"
      :rows="runner.rows.value"
      :message="outcomeMessage"
      @close="runner.clear"
      @retry="run(lastAction)"
      @refresh="query.refetch()"
    />
    <p
      v-if="query.isPending.value"
      role="status"
      aria-busy="true"
      class="text-gray-700 dark:text-gray-300"
    >
      {{ lt('datatables.loadingRecords') }}
    </p>
    <ProblemMessage
      v-else-if="query.isError.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <p v-else-if="!rows.length" role="status" class="text-gray-700 dark:text-gray-300">
      {{ lt(list.activeFilters.value.length ? 'datatables.zeroRecords' : 'datatables.emptyTable') }}
    </p>
    <TemporaryAliasList
      v-else
      :items="rows"
      :selection="selection.active.value"
      :selected="selectedIds"
      :can-change="access.canChange.value"
      :busy="runner.running.value"
      :limits="limits"
      @toggle="selection.toggle"
      @remove="run('remove', [$event])"
      @validity="(item, value) => run(value, [item])"
    />
    <PaginationBar
      :total="total"
      :page="list.state.value.page"
      :size="list.state.value.size"
      @update:page="list.setPage"
      @update:size="list.setSize($event as 25 | 50 | 100)"
    />
    <BulkActionBar
      v-if="selection.active.value"
      :count="selected.length"
      :actions="[{ id: 'remove', label: lt('mailbox.remove'), destructive: true }]"
      :busy="runner.running.value"
      @action="run('remove')"
      @clear="selection.clear"
    >
      <template #default="{ disabled }"
        ><ValidityActions v-if="limits" :limits="limits" :disabled="disabled" @change="run($event)"
      /></template>
    </BulkActionBar>
  </section>
</template>

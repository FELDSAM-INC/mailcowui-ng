<script setup lang="ts">
import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import ListToolbar from '@/shared/components/ListToolbar.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useDataList } from '@/shared/composables/useDataList'

import ActiveBadge from '@/shared/components/ActiveBadge.vue'

import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { problemOf, type AccountBulkActionRequest, type ApiProblem, type DomainAdmin } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt, resolveText } from '@/i18n'
import ActiveFilterChips from '@/shared/components/ActiveFilterChips.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import RowControls from '@/shared/components/RowControls.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import {
  isRetryable,
  rowsFromBulkResult,
  unknownRows,
  type BulkRow,
} from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useListState, type ListSchema } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'
import {
  activeAdminCountOptions,
  accountListOptions,
  applyAccountBulkAction,
  useAccountCapabilities,
  type AccountRole,
  type ManagedAccount,
} from '../api'
import { planBulk } from '../bulk'
import AccountActionsMenu from '../components/AccountActionsMenu.vue'
import AccountFilters from '../components/AccountFilters.vue'

import DomainAssignmentList from '../components/DomainAssignmentList.vue'
import SecondFactorStatusBadge from '../components/SecondFactorStatusBadge.vue'
import { takeAccountFlash } from '../flash'
import {
  adminListSchema,
  domainAdminListSchema,
  toAccountParams,
  type AccountFilters as Filters,
  type AccountSort,
} from '../list-state'
import { permissionLabels } from '../permissions'
import { useAccountActions } from '../useAccountActions'
const props = defineProps<{ role: AccountRole }>()
const { t } = useI18n(),
  route = useRoute(),
  router = useRouter(),
  client = useQueryClient(),
  confirm = useConfirm(),
  identity = useIdentityQuery()
const caps = useAccountCapabilities(),
  selection = useBulkSelection({ limit: () => caps.data.value?.bulkLimit ?? 100 })
const schema = props.role === 'admin' ? adminListSchema : domainAdminListSchema
const list = useListState(schema as ListSchema<Partial<Filters>, AccountSort>, {
  onReset: () => selection.clear(),
})
const state = list.state,
  params = computed(() => toAccountParams(state.value))
const query = useQuery(
  computed(() => ({
    ...accountListOptions(props.role, params.value),
    placeholderData: keepPreviousData,
  })),
)
const entries = computed(() => query.data.value?.data ?? []),
  total = computed(() => query.data.value?.meta.total ?? 0)
const count = useQuery(
  computed(() => ({ ...activeAdminCountOptions(), enabled: props.role === 'admin' })),
)
const allowed = computed(() => identity.data.value?.role === 'admin')
const wide = useMediaQuery('(min-width: 768px)'),
  running = ref(false),
  rows = ref<BulkRow[]>([]),
  failure = shallowRef<ApiProblem | null>(null),
  notice = ref(takeAccountFlash(''))
const actions = useAccountActions({
  role: () => props.role,
  allowed: () => allowed.value,
  ownUsername: () => identity.data.value?.username ?? '',
  activeAdminCount: () => count.data.value ?? 1,
  context: () => route.fullPath,
})
const leave = useLeaveGuard(
  () => running.value || actions.pending.value,
  'domains.bulk.leaveRunning',
)
void leave
const search = ref(state.value.filters.q ?? '')
watch(
  () => state.value.filters.q,
  (value) => {
    if (search.value.trim() !== (value ?? '')) search.value = value ?? ''
  },
)

function clearFilters() {
  search.value = ''
  void list.setFilters({
    q: undefined,
    status: undefined,
    tfa: undefined,
    pending: undefined,
    domain: [],
    permission: undefined,
    permissionValue: 'on',
  })
}
const chips = computed(() => {
  const f = state.value.filters,
    result = []
  if (f.q) result.push({ key: 'q', label: f.q })
  if (f.status)
    result.push({
      key: 'status',
      label: lt(f.status === 'active' ? 'mailbox.active' : 'mailbox.inactive'),
    })
  if (f.tfa)
    result.push({
      key: 'tfa',
      label: `${lt('tfa.tfa')}: ${f.tfa === 'suspended' ? t('accounts.secondFactorStatus.suspended') : lt(f.tfa === 'active' ? 'mailbox.active' : 'mailbox.inactive')}`,
    })
  if (f.pending)
    result.push({
      key: 'pending',
      label: lt(f.pending === 'passwordChange' ? 'edit.force_pw_update' : 'tfa.force_tfa'),
    })
  for (const name of f.domain ?? []) result.push({ key: `domain:${name}`, label: name })
  if (f.permission)
    result.push({
      key: 'permission',
      label: `${resolveText(permissionLabels[f.permission], t)}: ${t(f.permissionValue === 'off' ? 'lists.filters.no' : 'lists.filters.yes')}`,
    })
  return result
})
function removeChip(key: string) {
  if (key.startsWith('domain:'))
    void list.setFilter(
      'domain',
      state.value.filters.domain?.filter((value) => value !== key.slice(7)),
    )
  else if (key === 'permission')
    void list.setFilters({ permission: undefined, permissionValue: 'on' })
  else void list.setFilter(key, undefined)
}

const own = (account: ManagedAccount) =>
  props.role === 'admin' && account.username === identity.data.value?.username
const lastActive = (account: ManagedAccount) =>
  props.role === 'admin' && account.active && (count.data.value ?? 1) <= 1
const detail = (account: ManagedAccount, edit = false) =>
  router.resolve({
    name: props.role === 'admin' ? 'admin-detail' : 'domain-admin-detail',
    params: { username: account.username },
    query: edit ? { edit: 'account' } : undefined,
  }).fullPath
const allIds = computed(() => entries.value.map((item) => item.username))
const bulkActions = computed(() => [
  { id: 'activate', label: lt('mailbox.activate') },
  { id: 'deactivate', label: lt('mailbox.deactivate') },
  { id: 'suspendSecondFactors', label: lt('tfa.disable_tfa') },
  { id: 'delete', label: lt('mailbox.remove'), destructive: true },
])
let lastAction: AccountBulkActionRequest['action'] | null = null
async function bulk(action: AccountBulkActionRequest['action']) {
  if (running.value || !allowed.value || query.isPlaceholderData.value) return
  const context = route.fullPath,
    role = props.role
  const selected = entries.value.filter((item) => selection.isSelected(item.username))
  const plan = planBulk({
    role,
    action,
    selected,
    ownUsername: identity.data.value?.username ?? '',
    activeAdminCount: count.data.value ?? 1,
    bulkLimit: caps.data.value?.bulkLimit ?? 100,
  })
  notice.value = plan.excludedOwn ? t('accounts.bulk.ownExcluded') : null
  rows.value = plan.skippedNoSecondFactor.map((id) => ({ id, label: id, outcome: 'skipped' }))
  if (plan.blocked) {
    notice.value =
      plan.blocked === 'lastActiveAdmin'
        ? lt('warning.no_active_admin')
        : t('bulk.limitReached', { max: caps.data.value?.bulkLimit ?? 100 })
    return
  }
  if (!plan.targets.length) return
  if (
    plan.needsConfirmation &&
    !(await confirm({
      title:
        action === 'delete'
          ? lt('footer.confirm_delete')
          : bulkActions.value.find((item) => item.id === action)!.label,
      description: t(`accounts.bulk.${action}`, { count: plan.targets.length }),
      confirmLabel:
        action === 'delete'
          ? lt('footer.delete_now')
          : bulkActions.value.find((item) => item.id === action)!.label,
      destructive: true,
      ...(plan.needsConfirmation === 'typedCount'
        ? {
            requireTyped: {
              accepted: [String(plan.targets.length)],
              labelKey: 'bulk.confirm.typeCount',
              labelParams: { count: plan.targets.length },
            },
          }
        : {}),
    }))
  )
    return
  if (running.value || !allowed.value || route.fullPath !== context) return
  const rechecked = planBulk({
    role,
    action,
    selected: entries.value.filter((item) =>
      plan.targets.some((target) => target.id === item.username),
    ),
    ownUsername: identity.data.value?.username ?? '',
    activeAdminCount: count.data.value ?? 1,
    bulkLimit: caps.data.value?.bulkLimit ?? 100,
  })
  if (rechecked.blocked || rechecked.targets.length !== plan.targets.length) return
  running.value = true
  failure.value = null
  lastAction = action
  const names = plan.targets.map((target) => ({ name: target.id, unicodeName: target.id }))
  try {
    const result = await applyAccountBulkAction(client, role, { action, targets: plan.targets })
    rows.value = [...rows.value, ...rowsFromBulkResult(result, names)]
    selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
  } catch (error) {
    failure.value = problemOf(error)
    if (failure.value?.kind === 'network') {
      rows.value = [...rows.value, ...unknownRows(names)]
      selection.clear()
    }
  } finally {
    running.value = false
  }
}
async function retryBulk() {
  if (!lastAction || running.value) return
  const refreshed = await query.refetch()
  if (!refreshed.error) await bulk(lastAction)
}
const filterKey = computed(() => JSON.stringify(state.value.filters))
let announced = filterKey.value
watch([query.data, query.isPlaceholderData], ([data, placeholder]) => {
  if (data && !placeholder && filterKey.value !== announced) {
    announced = filterKey.value
    announce(t('accounts.count', { count: data.meta.total }))
  }
})

const dataList = useDataList(
  () => 'accounts-' + props.role,
  () => ({
    key: state.value.sort,
    order: state.value.order ?? 'asc',
    change: (key, order) => void list.setSort(key as AccountSort, order),
  }),
)

const tableView = useDataColumns(
  () =>
    [
      { id: 'username', label: lt('admin.username'), sort: 'username' },
      { id: 'domainCount', label: lt('admin.admin_domains'), sort: 'domainCount' },
      { id: 'secondFactor', label: lt('tfa.tfa') },
    ].filter((column) => column.id !== 'domainCount' || props.role === 'domainAdmin'),
  undefined,
  dataList,
)
</script>
<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-4">
    <PageHeader :title="lt(role === 'admin' ? 'admin.admin_details' : 'admin.domain_admins')"
      ><template #actions
        ><RouterLink
          v-if="allowed"
          :to="{ name: role === 'admin' ? 'admin-create' : 'domain-admin-create' }"
          :class="buttonVariants({ variant: 'default' })"
          >{{ lt(role === 'admin' ? 'admin.add_admin' : 'admin.add_domain_admin') }}</RouterLink
        ></template
      ></PageHeader
    >
    <div class="flex flex-wrap items-end gap-3">
      <ListToolbar
        ><template #select
          ><button
            v-if="allowed"
            type="button"
            data-selection-mode
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="running"
            @click="selection.active.value ? selection.leave() : selection.enter()"
          >
            {{ t(selection.active.value ? 'bulk.exitSelection' : 'bulk.select') }}
          </button></template
        ><template #filters
          ><AccountFilters
            :role="role"
            :filters="state.filters"
            :active-count="chips.filter((chip) => chip.key !== 'q').length"
            @apply="list.setFilters"
            @clear="clearFilters" /></template
        ><template #search
          ><SearchField
            id="account-search"
            :label="lt('datatables.search')"
            :model-value="state.filters.q ?? ''"
            @search="
              (value) => list.setFilter('q', value || undefined, { typing: true })
            " /></template
        ><template #actions
          ><button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="query.isFetching.value"
            @click="query.refetch()"
          >
            {{ t('bulk.refreshList') }}
          </button></template
        ></ListToolbar
      >
    </div>

    <ActiveFilterChips :chips="chips" @remove="removeChip" @clear="clearFilters" />

    <p v-if="notice || actions.notice.value" role="status">{{ notice ?? actions.notice.value }}</p>
    <ProblemMessage :problem="failure ?? actions.problem.value" />
    <p v-if="query.error.value && query.data.value" role="alert">{{ t('lists.refreshFailed') }}</p>
    <ListState
      :loading="query.isPending.value"
      :empty="!entries.length"
      :problem="query.data.value ? null : problemOf(query.error.value)"
      :empty-text="lt(chips.length ? 'datatables.zeroRecords' : 'datatables.emptyTable')"
      @retry="query.refetch()"
    >
      <template #empty
        ><p>{{ lt(chips.length ? 'datatables.zeroRecords' : 'datatables.emptyTable') }}</p>
        <p v-if="!chips.length" class="mt-2">
          {{ t(role === 'domainAdmin' ? 'accounts.empty.domainAdmin' : 'accounts.empty.admin') }}
        </p>
        <button
          v-else
          type="button"
          :class="buttonVariants({ variant: 'outline', class: 'mt-3' })"
          @click="clearFilters"
        >
          {{ t('lists.chips.clearAll') }}
        </button></template
      >
      <div v-if="selection.active.value" class="flex items-center gap-2">
        <SelectCheckbox
          :label="t('bulk.selectAll')"
          :checked="selection.allSelected(allIds)"
          :disabled="running || query.isPlaceholderData.value"
          @change="$event ? selection.selectPage(allIds) : selection.clear()"
        /><span>{{ lt('mailbox.toggle_all') }}</span>
      </div>
      <div v-if="wide" class="table-frame">
        <table class="data-table w-full table-fixed text-start text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-800">
              <th v-if="selection.active.value" class="w-12">
                <span class="sr-only">{{ t('bulk.select') }}</span>
              </th>
              <DataTableHeader column="username" />
              <DataTableHeader v-if="role === 'domainAdmin'" column="domainCount" />
              <DataTableHeader column="secondFactor" />

              <th class="table-controls-cell p-3 text-end">{{ lt('admin.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="account in entries"
              :key="account.username"
              :data-account-row="account.username"
              class="border-b border-gray-200 dark:border-gray-800"
            >
              <td v-if="selection.active.value">
                <SelectCheckbox
                  :label="t('bulk.selectItem', { name: account.username })"
                  :checked="selection.isSelected(account.username)"
                  :disabled="
                    running ||
                    !selection.canSelect(account.username) ||
                    query.isPlaceholderData.value
                  "
                  described-by="bulk-limit-message"
                  @change="selection.toggle(account.username)"
                />
              </td>
              <td v-show="tableView.visible('username')" :data-column="'username'" class="p-3">
                <RouterLink
                  :to="detail(account)"
                  class="inline-flex min-h-11 items-center wrap-anywhere font-medium underline underline-offset-4"
                  >{{ account.username }}</RouterLink
                ><span v-if="own(account)" class="ms-2 text-xs">{{ t('accounts.you') }}</span>
                <div class="mt-1"><ActiveBadge :active="account.active" /></div>
              </td>

              <td
                v-if="'domains' in account"
                v-show="tableView.visible('domainCount')"
                :data-column="'domainCount'"
                class="p-3"
              >
                <DomainAssignmentList
                  :assignments="(account as DomainAdmin).domains"
                  :account-active="account.active"
                  :limit="3"
                />
              </td>
              <td
                v-show="tableView.visible('secondFactor')"
                :data-column="'secondFactor'"
                class="p-3"
              >
                <SecondFactorStatusBadge :status="account.secondFactorStatus" />
              </td>
              <td class="table-controls-cell p-1">
                <RowControls>
                  <AccountActionsMenu
                    v-if="allowed"
                    :account="account"
                    :detail-to="detail(account, true)"
                    :own="own(account)"
                    :last-active="lastActive(account)"
                    :busy="running || actions.pending.value"
                    @action="actions.run($event, account)"
                  />
                </RowControls>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul v-else class="flex flex-col gap-3">
        <DataCard
          v-for="account in entries"
          :key="account.username"
          :data-account-row="account.username"
          :to="detail(account)"
        >
          <template #badges><ActiveBadge :active="account.active" /></template
          ><template #title>
            {{ account.username }}
            <span v-if="own(account)" class="ms-2 text-xs">{{ t('accounts.you') }}</span>
          </template>
          <template v-if="selection.active.value" #select>
            <SelectCheckbox
              v-if="selection.active.value"
              :label="t('bulk.selectItem', { name: account.username })"
              :checked="selection.isSelected(account.username)"
              :disabled="
                running || !selection.canSelect(account.username) || query.isPlaceholderData.value
              "
              described-by="bulk-limit-message"
              @change="selection.toggle(account.username)"
            />
          </template>
          <template v-if="allowed" #actions>
            <AccountActionsMenu
              v-if="allowed"
              :account="account"
              :detail-to="detail(account, true)"
              :own="own(account)"
              :last-active="lastActive(account)"
              :busy="running || actions.pending.value"
              @action="actions.run($event, account)"
            />
          </template>
          <DataCardFields>
            <template v-if="'domains' in account">
              <dt class="font-medium">{{ lt('admin.admin_domains') }}</dt>
              <dd>
                <DomainAssignmentList
                  :assignments="(account as DomainAdmin).domains"
                  :account-active="account.active"
                  :limit="3"
                />
              </dd>
            </template>
            <dt class="font-medium">{{ lt('tfa.tfa') }}</dt>
            <dd><SecondFactorStatusBadge :status="account.secondFactorStatus" /></dd>
          </DataCardFields>
        </DataCard>
      </ul>
    </ListState>
    <PaginationBar
      :total="total"
      :page="state.page"
      :size="state.size"
      @update:page="list.setPage"
      @update:size="list.setSize($event as 25 | 50 | 100)"
    />
    <BulkResultSummary
      v-if="rows.length"
      :rows="rows"
      @close="rows = []"
      @retry="retryBulk"
      @refresh="query.refetch()"
    />
    <BulkActionBar
      v-if="selection.active.value"
      :count="selection.count.value"
      :actions="bulkActions"
      :busy="running || query.isPlaceholderData.value"
      :limit-message="
        selection.limitReached.value ? t('bulk.limitReached', { max: selection.limit.value }) : null
      "
      @action="bulk($event as AccountBulkActionRequest['action'])"
      @clear="selection.clear()"
    />
  </section>
</template>

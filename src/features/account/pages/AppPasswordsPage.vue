<script setup lang="ts">
import SettingsPage from '@/shared/components/SettingsPage.vue'
import DataRow from '@/shared/components/DataRow.vue'

import DataIdentity from '@/shared/components/DataIdentity.vue'

import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import ListToolbar from '@/shared/components/ListToolbar.vue'
import FilterPanel from '@/shared/components/FilterPanel.vue'
import { useDataList } from '@/shared/composables/useDataList'

import ActiveBadge from '@/shared/components/ActiveBadge.vue'

import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { isApiProblem, problemOf, type AppPassword } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import type { BulkRow } from '@/shared/components/bulk-row'
import LegacyText from '@/shared/components/LegacyText.vue'
import MailboxContextHeader from '../components/layout/MailboxContextHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { usePerItemRunner } from '@/shared/composables/usePerItemRunner'
import { buttonVariants } from '@/shared/ui/button'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'
import RowControls from '@/shared/components/RowControls.vue'
import { deleteAppPassword, updateAppPassword, useAppPasswords } from '../api/app-passwords'
import AppPasswordDeleteList from '../components/app-passwords/AppPasswordDeleteList.vue'
import { useAppPasswordContext } from '../composables/useAppPasswordContext'
import { APP_PASSWORD_PROTOCOL_ORDER, appPasswordProtocolListKey } from '../labels'
import { useAppPasswordListState } from '../list-state'
const { t } = useI18n()
const client = useQueryClient()
const { access, mailbox, location } = useAppPasswordContext()
const selection = useBulkSelection()
const list = useAppPasswordListState({ onReset: selection.clear })
const query = useAppPasswords(mailbox, list.params)
const rows = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const notFound = computed(() => isApiProblem(query.error.value) && query.error.value.status === 404)
const wide = useMediaQuery('(min-width: 768px)')
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const runner = usePerItemRunner()
useLeaveGuard(() => runner.running.value, 'domains.bulk.leaveRunning')
const lastAction = ref<'activate' | 'deactivate' | 'remove'>('remove')

const selected = computed(() => rows.value.filter((item) => selection.isSelected(String(item.id))))
const outcomeMessage = (row: BulkRow) =>
  row.outcome === 'done'
    ? lt(
        lastAction.value === 'remove' ? 'success.app_passwd_removed' : 'success.object_modified',
        row.id,
      )
    : null
const protocols = (item: AppPassword) =>
  APP_PASSWORD_PROTOCOL_ORDER.filter((p) => item.protocols.includes(p))
    .map((p) => t(appPasswordProtocolListKey(p)))
    .join(', ') || '–'
function toggleAll() {
  const ids = rows.value.map((item) => String(item.id))
  if (selection.allSelected(ids)) selection.clear()
  else selection.selectPage(ids)
}
async function run(action: 'activate' | 'deactivate' | 'remove', items = selected.value) {
  if (!access.canChange.value || runner.running.value || !items.length) return
  const owner = mailbox.value
  if (
    action === 'remove' &&
    !(await confirm({
      title: lt('footer.confirm_delete'),
      content: {
        component: AppPasswordDeleteList,
        props: { names: items.map((item) => item.name) },
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
  if (disposed || owner !== mailbox.value || !access.canChange.value || runner.running.value) return
  lastAction.value = action
  await runner.run(
    items.map((item) => ({ ...item, id: String(item.id), label: item.name })),
    (item) =>
      action === 'remove'
        ? deleteAppPassword(client, owner, Number(item.id), item.etag)
        : updateAppPassword(
            client,
            owner,
            Number(item.id),
            { active: action === 'activate' },
            item.etag,
          ),
  )
  selection.keep(
    runner.rows.value
      .filter((row) => ['failed', 'refused', 'outdated', 'notProcessed'].includes(row.outcome))
      .map((row) => row.id),
  )
  await query.refetch()
}
watch(
  () => access.canChange.value,
  (allowed) => {
    if (!allowed) selection.leave()
  },
)
watch([total, () => list.state.value.page], ([count, page]) => {
  if (count > 0 && (page - 1) * list.state.value.size >= count)
    void list.setPage(Math.max(1, Math.ceil(count / list.state.value.size)))
})

const dataList = useDataList(
  'account-pages-apppasswordspage',
  () => ({
    key: list.state.value.sort,
    order: list.state.value.order ?? 'asc',
    change: (key, order) =>
      void list.setSort(key as NonNullable<typeof list.state.value.sort>, order),
  }),
  () => ({ run: () => query.refetch(), pending: query.isFetching.value, disabled: false }),
)

const tableView = useDataColumns(
  () => [
    { id: 'id', label: t('lists.id') },
    { id: 'name', label: lt('user.app_name'), sort: 'name' },
    { id: 'protocols', label: lt('user.allowed_protocols') },
  ],
  undefined,
  dataList,
)
</script>
<template>
  <NotFoundPage v-if="notFound" />
  <SettingsPage v-else>
    <template #header>
      <MailboxContextHeader :title="lt('user.app_passwds')">
        <template #actions
          ><RouterLink
            v-if="access.canChange.value"
            :to="location('create')"
            :class="buttonVariants({})"
            >{{ lt('user.create_app_passwd') }}</RouterLink
          ></template
        >
      </MailboxContextHeader>
    </template>
    <LegacyText k="user.app_hint" as="p" class="text-gray-700 dark:text-gray-300" />
    <ListToolbar
      ><template v-if="access.canChange.value" #select
        ><button
          type="button"
          :disabled="runner.running.value"
          :class="buttonVariants({ variant: 'outline' })"
          @click="selection.active.value ? selection.leave() : selection.enter()"
        >
          {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
        </button></template
      ><template #filters
        ><FilterPanel
          id="account-pages-AppPasswordsPage"
          :active-count="list.activeFilters.value.filter((item) => item !== 'q').length"
          immediate
          ><label class="flex min-h-11 flex-col gap-1 text-sm text-gray-800 dark:text-gray-200"
            >{{ lt('user.active')
            }}<select
              class="form-control"
              :value="list.state.value.filters.active ?? ''"
              @change="
                list.setFilter(
                  'active',
                  (($event.target as HTMLSelectElement).value || undefined) as
                    'yes' | 'no' | undefined,
                )
              "
            >
              <option value="">{{ t('lists.filters.all') }}</option>
              <option value="yes">{{ t('lists.filters.yes') }}</option>
              <option value="no">{{ t('lists.filters.no') }}</option>
            </select></label
          ></FilterPanel
        ></template
      ><template #search
        ><SearchField
          id="app-password-search"
          :model-value="list.state.value.filters.q ?? ''"
          :label="lt('datatables.search')"
          @search="list.setFilter('q', $event || undefined, { typing: true })" /></template
    ></ListToolbar>

    <div v-if="access.canChange.value" class="flex flex-wrap gap-2">
      <template v-if="selection.active.value"
        ><button
          type="button"
          :disabled="runner.running.value"
          :class="buttonVariants({ variant: 'outline' })"
          @click="toggleAll"
        >
          {{ lt('mailbox.toggle_all') }}</button
        ><button
          v-for="action in ['activate', 'deactivate', 'remove'] as const"
          :key="action"
          type="button"
          :disabled="!selected.length || runner.running.value"
          :class="buttonVariants({ variant: 'outline' })"
          @click="run(action)"
        >
          {{
            lt(
              action === 'activate'
                ? 'mailbox.activate'
                : action === 'deactivate'
                  ? 'mailbox.deactivate'
                  : 'mailbox.remove',
            )
          }}
        </button></template
      >
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
    <div v-else-if="wide" class="table-frame">
      <table
        class="data-table w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
        data-app-password-list
      >
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800">
            <th v-if="selection.active.value" class="w-14 p-2">
              <span class="sr-only">{{ lt('mailbox.toggle_all') }}</span>
            </th>
            <DataTableHeader column="id" />
            <DataTableHeader column="name" />
            <DataTableHeader column="protocols" />

            <th class="table-controls-cell p-2 text-end">{{ lt('user.action') }}</th>
          </tr>
        </thead>
        <tbody>
          <DataRow
            v-for="item in rows"
            :key="item.id"
            :to="location('detail', item.id)"
            :label="item.name"
            :data-entry="item.id"
            class="border-b border-gray-200 dark:border-gray-800"
          >
            <td v-if="selection.active.value" class="p-2">
              <label class="flex size-11 items-center justify-center"
                ><span class="sr-only">{{ item.name }}</span
                ><input
                  type="checkbox"
                  class="size-5"
                  :checked="selection.isSelected(String(item.id))"
                  :disabled="runner.running.value"
                  @change="selection.toggle(String(item.id))"
              /></label>
            </td>
            <td v-show="tableView.visible('id')" :data-column="'id'" class="p-2">{{ item.id }}</td>
            <td v-show="tableView.visible('name')" :data-column="'name'" class="p-2 wrap-anywhere">
              <DataIdentity
                >{{ item.name }}<template #badges><ActiveBadge :active="item.active" /></template
              ></DataIdentity>
            </td>
            <td
              v-show="tableView.visible('protocols')"
              :data-column="'protocols'"
              class="p-2 wrap-anywhere"
            >
              <code>{{ protocols(item) }}</code>
            </td>

            <td class="table-controls-cell p-2">
              <RowControls>
                <RowActions
                  v-slot="{ menu }"
                  :count="access.canChange.value ? 2 : 1"
                  :label="`${lt('user.action')}: ${item.name}`"
                >
                  <RowAction
                    :menu="menu"
                    :to="location('detail', item.id)"
                    :label="lt('user.edit')"
                    :aria-label="`${lt('user.edit')}: ${item.name}`"
                  />
                  <RowAction
                    v-if="access.canChange.value"
                    :menu="menu"
                    :disabled="runner.running.value"
                    destructive
                    :label="lt('user.remove')"
                    :aria-label="`${lt('user.remove')}: ${item.name}`"
                    @select="run('remove', [item])"
                  />
                </RowActions>
              </RowControls>
            </td>
          </DataRow>
        </tbody>
      </table>
    </div>
    <ul v-else class="flex flex-col gap-3" data-app-password-list>
      <DataCard
        v-for="item in rows"
        :key="item.id"
        :data-entry="item.id"
        :title="item.name"
        :to="location('detail', item.id)"
      >
        <template #badges><ActiveBadge :active="item.active" /></template
        ><template v-if="selection.active.value" #select>
          <label v-if="selection.active.value" class="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              class="size-5"
              :checked="selection.isSelected(String(item.id))"
              :disabled="runner.running.value"
              @change="selection.toggle(String(item.id))"
            />
            <span class="sr-only">{{ item.name }}</span>
          </label>
        </template>
        <template #actions>
          <RowActions
            v-slot="{ menu }"
            :count="access.canChange.value ? 2 : 1"
            :label="`${lt('user.action')}: ${item.name}`"
          >
            <RowAction
              :menu="menu"
              :to="location('detail', item.id)"
              :label="lt('user.edit')"
              :aria-label="`${lt('user.edit')}: ${item.name}`"
            />
            <RowAction
              v-if="access.canChange.value"
              :menu="menu"
              :disabled="runner.running.value"
              destructive
              :label="lt('user.remove')"
              :aria-label="`${lt('user.remove')}: ${item.name}`"
              @select="run('remove', [item])"
            />
          </RowActions>
        </template>
        <DataCardFields>
          <div>
            <dt class="font-medium">{{ t('lists.id') }}</dt>
            <dd>{{ item.id }}</dd>
          </div>

          <div>
            <dt class="font-medium">{{ lt('user.allowed_protocols') }}</dt>
            <dd class="wrap-anywhere">
              <code>{{ protocols(item) }}</code>
            </dd>
          </div>
        </DataCardFields>
      </DataCard>
    </ul>
    <PaginationBar
      :total="total"
      :page="list.state.value.page"
      :size="list.state.value.size"
      @update:page="list.setPage"
      @update:size="list.setSize($event as 25 | 50 | 100)"
    />
  </SettingsPage>
</template>

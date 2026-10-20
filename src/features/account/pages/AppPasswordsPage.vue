<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { isApiProblem, problemOf, type AppPassword } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { usePerItemRunner } from '@/shared/composables/usePerItemRunner'
import { buttonVariants } from '@/shared/ui/button'
import { deleteAppPassword, updateAppPassword, useAppPasswords } from '../api/app-passwords'
import AppPasswordDeleteList from '../components/app-passwords/AppPasswordDeleteList.vue'
import { useAppPasswordContext } from '../composables/useAppPasswordContext'
import { APP_PASSWORD_PROTOCOL_ORDER, appPasswordProtocolListKey } from '../labels'
import { useAppPasswordListState, type AppPasswordSort } from '../list-state'
const { t } = useI18n()
const client = useQueryClient()
const { access, mailbox, mailboxContext, location } = useAppPasswordContext()
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
const sorts = ['name', 'createdAt', 'modifiedAt', 'active'] as const
const sortLabels = {
  name: 'user.app_name',
  createdAt: 'user.created_on',
  modifiedAt: 'mailbox.last_modified',
  active: 'user.active',
} as const
const selected = computed(() => rows.value.filter((item) => selection.isSelected(String(item.id))))
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
</script>
<template>
  <NotFoundPage v-if="notFound" />
  <section v-else class="flex flex-col gap-5">
    <PageHeader :title="lt('user.app_passwds')" :description="mailboxContext ? mailbox : undefined">
      <template #actions
        ><RouterLink
          v-if="access.canChange.value"
          :to="location('create')"
          :class="buttonVariants({})"
          >{{ lt('user.create_app_passwd') }}</RouterLink
        ></template
      >
    </PageHeader>
    <LegacyText k="user.app_hint" as="p" class="text-gray-700 dark:text-gray-300" />
    <SearchField
      id="app-password-search"
      :model-value="list.state.value.filters.q ?? ''"
      :label="lt('datatables.search')"
      @search="list.setFilter('q', $event || undefined, { typing: true })"
    />
    <div class="flex flex-wrap gap-3">
      <label class="flex min-h-11 flex-col gap-1 text-sm text-gray-800 dark:text-gray-200"
        >{{ lt('user.active')
        }}<select
          class="form-control"
          :value="list.state.value.filters.active ?? ''"
          @change="
            list.setFilter(
              'active',
              (($event.target as HTMLSelectElement).value || undefined) as 'yes' | 'no' | undefined,
            )
          "
        >
          <option value="">{{ t('lists.filters.all') }}</option>
          <option value="yes">{{ t('lists.filters.yes') }}</option>
          <option value="no">{{ t('lists.filters.no') }}</option>
        </select></label
      >
      <label class="flex min-h-11 flex-col gap-1 text-sm text-gray-800 dark:text-gray-200"
        >{{ t('lists.sort.label')
        }}<select
          class="form-control"
          :value="list.state.value.sort"
          @change="list.setSort(($event.target as HTMLSelectElement).value as AppPasswordSort)"
        >
          <option v-for="sort in sorts" :key="sort" :value="sort">
            {{ lt(sortLabels[sort]) }}
          </option>
        </select></label
      >
      <button
        type="button"
        class="self-end"
        :class="buttonVariants({ variant: 'outline' })"
        @click="
          list.setSort(
            list.state.value.sort ?? 'name',
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
        :disabled="runner.running.value"
        :class="buttonVariants({ variant: 'outline' })"
        @click="selection.active.value ? selection.leave() : selection.enter()"
      >
        {{ selection.active.value ? t('bulk.exitSelection') : t('bulk.select') }}
      </button>
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
    <table
      v-else-if="wide"
      class="w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
      data-app-password-list
    >
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-800">
          <th v-if="selection.active.value" class="w-14 p-2">
            <span class="sr-only">{{ lt('mailbox.toggle_all') }}</span>
          </th>
          <th class="w-16 p-2 text-start">{{ t('lists.id') }}</th>
          <th class="p-2 text-start">{{ lt('user.app_name') }}</th>
          <th class="p-2 text-start">{{ lt('user.allowed_protocols') }}</th>
          <th class="w-24 p-2 text-start">{{ lt('user.active') }}</th>
          <th class="w-44 p-2 text-start">{{ lt('user.action') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in rows"
          :key="item.id"
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
          <td class="p-2">{{ item.id }}</td>
          <td class="p-2 wrap-anywhere">{{ item.name }}</td>
          <td class="p-2 wrap-anywhere">
            <code>{{ protocols(item) }}</code>
          </td>
          <td class="p-2">{{ lt(item.active ? 'user.active' : 'mailbox.inactive') }}</td>
          <td class="p-2">
            <div class="flex flex-wrap gap-1">
              <RouterLink
                :to="location('detail', item.id)"
                :aria-label="`${lt('user.edit')}: ${item.name}`"
                :class="buttonVariants({ variant: 'outline', size: 'sm' })"
                >{{ lt('user.edit') }}</RouterLink
              ><button
                v-if="access.canChange.value"
                type="button"
                :disabled="runner.running.value"
                :aria-label="`${lt('user.remove')}: ${item.name}`"
                :class="buttonVariants({ variant: 'outline', size: 'sm' })"
                @click="run('remove', [item])"
              >
                {{ lt('user.remove') }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <ul v-else class="flex flex-col gap-3" data-app-password-list>
      <li
        v-for="item in rows"
        :key="item.id"
        :data-entry="item.id"
        class="surface flex min-w-0 flex-col gap-3 text-sm text-gray-800 dark:text-gray-200"
      >
        <label v-if="selection.active.value" class="flex min-h-11 items-center gap-3"
          ><input
            type="checkbox"
            class="size-5"
            :checked="selection.isSelected(String(item.id))"
            :disabled="runner.running.value"
            @change="selection.toggle(String(item.id))"
          />{{ item.name }}</label
        >
        <dl class="grid gap-2">
          <div>
            <dt class="font-medium">{{ t('lists.id') }}</dt>
            <dd>{{ item.id }}</dd>
          </div>
          <div>
            <dt class="font-medium">{{ lt('user.app_name') }}</dt>
            <dd class="wrap-anywhere">{{ item.name }}</dd>
          </div>
          <div>
            <dt class="font-medium">{{ lt('user.allowed_protocols') }}</dt>
            <dd class="wrap-anywhere">
              <code>{{ protocols(item) }}</code>
            </dd>
          </div>
          <div>
            <dt class="font-medium">{{ lt('user.active') }}</dt>
            <dd>{{ lt(item.active ? 'user.active' : 'mailbox.inactive') }}</dd>
          </div>
        </dl>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            :to="location('detail', item.id)"
            :aria-label="`${lt('user.edit')}: ${item.name}`"
            :class="buttonVariants({ variant: 'outline' })"
            >{{ lt('user.edit') }}</RouterLink
          ><button
            v-if="access.canChange.value"
            type="button"
            :disabled="runner.running.value"
            :aria-label="`${lt('user.remove')}: ${item.name}`"
            :class="buttonVariants({ variant: 'outline' })"
            @click="run('remove', [item])"
          >
            {{ lt('user.remove') }}
          </button>
        </div>
      </li>
    </ul>
    <PaginationBar
      :total="total"
      :page="list.state.value.page"
      :size="list.state.value.size"
      @update:page="list.setPage"
      @update:size="list.setSize($event as 25 | 50 | 100)"
    />
  </section>
</template>

<script setup lang="ts">
import DataIdentity from '@/shared/components/DataIdentity.vue'

import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

import ActiveBadge from '@/shared/components/ActiveBadge.vue'

// The sync job list as a table from md up (FR-005, FR-011): the classic columns of the role's table
// with sortable headers (`aria-sort`), and the classic collapsed values (excludes, interval and,
// for mailbox users, the encryption) in an expandable row. Slots: `select-all`, `select`, `actions`.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Role, SyncJob } from '@/api'
import { resolveText, type TextRef } from '@/i18n'
import { useFormat } from '@/i18n/format'
import type { SortOrder } from '@/shared/composables/useListState'
import RowControls from '@/shared/components/RowControls.vue'

import type { SyncJobSort } from '../list-state'
import { jobLabel, listTexts } from '../presentation'
import SyncJobLastRun from './SyncJobLastRun.vue'
import SyncJobResult from './SyncJobResult.vue'
import SyncJobStateBadges from './SyncJobStateBadges.vue'

const props = withDefaults(
  defineProps<{
    hidden?: boolean
    jobs: readonly SyncJob[]
    role: Role
    sort: SyncJobSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{
  sort: [sort: SyncJobSort, order: SortOrder]
}>()
const { t } = useI18n()
const fmt = useFormat()
const expanded = ref(new Set<number>())
const texts = computed(() => listTexts(props.role))
const manager = computed(() => props.role !== 'mailboxUser')

type Column = 'id' | 'owner' | 'server' | 'username' | 'lastRun' | 'result' | 'active' | 'status'
interface ColumnSpec {
  key: Column
  label: TextRef
  sort?: SyncJobSort
}

const columns = computed<ColumnSpec[]>(() => [
  { key: 'id', label: 'syncJobs.columns.id', sort: 'id' },
  ...(manager.value
    ? [{ key: 'owner' as const, label: texts.value.owner, sort: 'mailbox' as const }]
    : []),
  { key: 'server', label: 'syncJobs.columns.server', sort: 'remoteHost' },
  ...(manager.value
    ? []
    : [{ key: 'username' as const, label: texts.value.username, sort: 'remoteUser' as const }]),
  { key: 'lastRun', label: texts.value.lastRun, sort: 'lastRunAt' },
  { key: 'result', label: texts.value.result, sort: 'lastResult' },

  { key: 'status', label: texts.value.status },
])

const label = (ref: TextRef) => resolveText(ref, t)

function sortBy(key: SyncJobSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

function toggle(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

const columnCount = computed(() => columns.value.length + 1 + (props.selectable ? 1 : 0))

const tableView = useDataColumns(
  () =>
    columns.value.map((column) => ({
      id: column.key,
      label: label(column.label),
      sort: column.sort,
    })),
  () => ({
    key: props.sort,
    order: props.order,
    change: (key) => sortBy(key as Parameters<typeof sortBy>[0]),
  }),
)
</script>

<template>
  <div v-if="!hidden" class="table-frame">
    <table class="data-table w-full table-auto text-sm">
      <caption class="sr-only">
        {{
          label(texts.title)
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-2 py-2"><slot name="select-all" /></th>
          <DataTableHeader
            v-for="column in columns"
            :key="column.key"
            :column="String(column.key)"
            class="px-2 py-2 text-start"
          />
          <th scope="col" class="table-controls-cell px-2 py-2 text-end">
            {{ label(texts.action) }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="job in jobs" :key="job.id">
          <tr :data-entry="job.id" class="align-top text-gray-900 dark:text-white">
            <td v-if="selectable" class="px-2 py-2"><slot name="select" :job="job" /></td>
            <td
              v-show="tableView.visible(String('id'))"
              :data-column="String('id')"
              class="px-2 py-3"
            >
              <DataIdentity
                ><RouterLink
                  :to="{ name: 'sync-job-detail', params: { syncJobId: job.id } }"
                  class="inline-flex min-h-6 font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  {{ job.id }} </RouterLink
                ><template #badges><ActiveBadge :active="job.active" /></template
              ></DataIdentity>
            </td>
            <td
              v-show="tableView.visible(String('owner'))"
              v-if="manager"
              :data-column="String('owner')"
              class="max-w-48 px-2 py-3 wrap-anywhere"
            >
              {{ job.mailbox }}
            </td>
            <td
              v-show="tableView.visible(String('server'))"
              :data-column="String('server')"
              class="max-w-64 px-2 py-3 wrap-anywhere"
            >
              {{ jobLabel(job) }}
            </td>
            <td
              v-show="tableView.visible(String('username'))"
              v-if="!manager"
              :data-column="String('username')"
              class="max-w-48 px-2 py-3 wrap-anywhere"
            >
              {{ job.remoteUser }}
            </td>
            <td
              v-show="tableView.visible(String('lastRun'))"
              :data-column="String('lastRun')"
              class="px-2 py-3"
            >
              <SyncJobLastRun :run="job.runStatus" :role="role" />
            </td>
            <td
              v-show="tableView.visible(String('result'))"
              :data-column="String('result')"
              class="max-w-56 px-2 py-3"
            >
              <SyncJobResult :run="job.runStatus" :role="role" />
            </td>

            <td
              v-show="tableView.visible(String('status'))"
              :data-column="String('status')"
              class="px-2 py-3"
            >
              <SyncJobStateBadges
                :active="job.active"
                :running="job.runStatus.running"
                :role="role"
              />
            </td>
            <td class="table-controls-cell px-2 py-1">
              <RowControls
                :expanded="expanded.has(job.id)"
                :controls="`sync-job-details-${job.id}`"
                :label="t('syncJobs.list.detailsOf', { name: jobLabel(job) })"
                @toggle="toggle(job.id)"
              >
                <slot name="actions" :job="job" />
              </RowControls>
            </td>
          </tr>
          <tr v-if="expanded.has(job.id)" :id="`sync-job-details-${job.id}`">
            <td
              :colspan="columnCount - tableView.columns.value.length + tableView.visibleCount.value"
              class="bg-gray-50 px-4 py-3 dark:bg-gray-950"
            >
              <dl
                :data-entry-details="job.id"
                class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm"
              >
                <template v-if="!manager">
                  <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.encryption) }}</dt>
                  <dd class="text-gray-900 dark:text-white">
                    {{ t(`enums.syncJobEncryption.${job.encryption}`) }}
                  </dd>
                </template>
                <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.excludes) }}</dt>
                <dd class="wrap-anywhere text-gray-900 dark:text-white">
                  <code v-if="job.exclude">{{ job.exclude }}</code>
                  <template v-else>-</template>
                </dd>
                <dt class="text-gray-600 dark:text-gray-400">
                  {{ label(texts.interval)
                  }}<template v-if="!manager">{{ ` ${t('syncJobs.columns.minutes')}` }}</template>
                </dt>
                <dd class="text-gray-900 dark:text-white">{{ fmt.number(job.intervalMinutes) }}</dd>
              </dl>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

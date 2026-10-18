<script setup lang="ts">
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
import { ChevronDownIcon } from '@/shared/icons'

import type { SyncJobSort } from '../list-state'
import { jobLabel, listTexts } from '../presentation'
import SyncJobLastRun from './SyncJobLastRun.vue'
import SyncJobResult from './SyncJobResult.vue'
import SyncJobStateBadges from './SyncJobStateBadges.vue'

const props = withDefaults(
  defineProps<{
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
  openLog: [job: SyncJob]
}>()
const { t } = useI18n()
const fmt = useFormat()
const expanded = ref(new Set<number>())
const texts = computed(() => listTexts(props.role))
const manager = computed(() => props.role !== 'mailboxUser')

type Column =
  'id' | 'owner' | 'server' | 'username' | 'lastRun' | 'result' | 'log' | 'active' | 'status'
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
  { key: 'log', label: 'syncJobs.columns.log' },
  { key: 'active', label: texts.value.active, sort: 'active' },
  { key: 'status', label: texts.value.status },
])

const label = (ref: TextRef) => resolveText(ref, t)

function ariaSort(key: SyncJobSort | undefined) {
  if (!key) return undefined
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

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
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
    <table class="w-full table-auto text-sm">
      <caption class="sr-only">
        {{
          label(texts.title)
        }}
      </caption>
      <thead
        class="border-b border-gray-200 text-start text-gray-600 dark:border-gray-800 dark:text-gray-400"
      >
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-2 py-2"><slot name="select-all" /></th>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            class="px-2 py-2 text-start font-medium"
            :aria-sort="ariaSort(column.sort)"
          >
            <button
              v-if="column.sort"
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start font-medium hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.sort)"
            >
              {{ label(column.label) }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
            <template v-else>{{ label(column.label) }}</template>
          </th>
          <th scope="col" class="px-2 py-2 text-end font-medium">{{ label(texts.action) }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="job in jobs" :key="job.id">
          <tr :data-entry="job.id" class="align-top text-gray-900 dark:text-white">
            <td v-if="selectable" class="px-2 py-2"><slot name="select" :job="job" /></td>
            <td class="px-2 py-3">
              <RouterLink
                :to="{ name: 'sync-job-detail', params: { syncJobId: job.id } }"
                class="inline-flex min-h-6 font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                {{ job.id }}
              </RouterLink>
            </td>
            <td v-if="manager" class="max-w-48 px-2 py-3 wrap-anywhere">{{ job.mailbox }}</td>
            <td class="max-w-64 px-2 py-3 wrap-anywhere">{{ jobLabel(job) }}</td>
            <td v-if="!manager" class="max-w-48 px-2 py-3 wrap-anywhere">{{ job.remoteUser }}</td>
            <td class="px-2 py-3"><SyncJobLastRun :run="job.runStatus" :role="role" /></td>
            <td class="max-w-56 px-2 py-3">
              <SyncJobResult
                :run="job.runStatus"
                :role="role"
                log-link
                @open-log="emit('openLog', job)"
              />
            </td>
            <td class="px-2 py-3">
              <button
                type="button"
                class="min-h-6 text-start font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
                :aria-label="`${label(texts.openLogs)}: ${jobLabel(job)}`"
                @click="emit('openLog', job)"
              >
                {{ label(texts.openLogs) }}
              </button>
            </td>
            <td class="px-2 py-3">
              <SyncJobStateBadges
                show="active"
                :active="job.active"
                :running="job.runStatus.running"
                :role="role"
              />
            </td>
            <td class="px-2 py-3">
              <SyncJobStateBadges
                :active="job.active"
                :running="job.runStatus.running"
                :role="role"
              />
            </td>
            <td class="px-2 py-1">
              <div class="flex items-center justify-end">
                <button
                  type="button"
                  class="inline-flex size-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
                  :aria-expanded="expanded.has(job.id) ? 'true' : 'false'"
                  :aria-controls="`sync-job-details-${job.id}`"
                  :aria-label="t('syncJobs.list.detailsOf', { name: jobLabel(job) })"
                  @click="toggle(job.id)"
                >
                  <ChevronDownIcon
                    class="size-5 motion-safe:transition-transform"
                    :class="expanded.has(job.id) ? 'rotate-180' : ''"
                  />
                </button>
                <slot name="actions" :job="job" />
              </div>
            </td>
          </tr>
          <tr v-if="expanded.has(job.id)" :id="`sync-job-details-${job.id}`">
            <td :colspan="columnCount" class="bg-gray-50 px-4 py-3 dark:bg-gray-950">
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

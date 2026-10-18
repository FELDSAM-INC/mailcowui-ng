<script setup lang="ts">
// The list's filters (FR-009), kept in the feature as UI 002 and UI 003 keep theirs (UI 006 creates
// the shared panel): active state, status and last result for every role, with the classic column
// keys as labels and their values as options. On phones a sort choice offers the table's sorts
// (FR-011). The search field lives on the page.
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role } from '@/api'
import { legacy, resolveText, type TextRef } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'
import { ChevronDownIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { SYNC_JOB_SORTS, type SyncJobListFilters, type SyncJobSort } from '../list-state'
import { listTexts } from '../presentation'

const props = defineProps<{
  role: Role
  filters: SyncJobListFilters
  activeCount: number
  sort: SyncJobSort
  order: SortOrder
  showSort: boolean
}>()
const emit = defineEmits<{
  update: [change: Partial<SyncJobListFilters>]
  clear: []
  sort: [sort: SyncJobSort, order: SortOrder]
}>()
const { t } = useI18n()
const open = ref(false)
const panelId = useId()
const texts = computed(() => listTexts(props.role))
const label = (ref: TextRef) => resolveText(ref, t)

const SORT_LABELS: Record<SyncJobSort, TextRef> = {
  id: 'syncJobs.columns.id',
  mailbox: legacy('mailbox.owner'),
  remoteHost: legacy('add.hostname'),
  remoteUser: legacy('add.username'),
  intervalMinutes: legacy('mailbox.mins_interval'),
  active: legacy('mailbox.active'),
  lastRunAt: legacy('mailbox.last_run'),
  lastResult: legacy('mailbox.syncjob_last_run_result'),
}
const sorts = computed(() =>
  SYNC_JOB_SORTS.filter((sort) => props.role !== 'mailboxUser' || sort !== 'mailbox'),
)

const SELECT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'

function value(event: Event): string | undefined {
  return (event.target as HTMLSelectElement).value || undefined
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-end gap-3">
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="panelId"
        @click="open = !open"
      >
        {{
          activeCount > 0
            ? t('syncJobs.filters.withCount', { count: activeCount })
            : t('syncJobs.filters.title')
        }}
        <ChevronDownIcon
          class="size-4 motion-safe:transition-transform"
          :class="open ? 'rotate-180' : ''"
        />
      </button>
      <template v-if="showSort">
        <div class="flex flex-col gap-1.5">
          <label for="sync-job-sort" class="text-sm font-medium text-gray-800 dark:text-gray-200">
            {{ t('syncJobs.sort.label') }}
          </label>
          <select
            id="sync-job-sort"
            :value="sort"
            :class="SELECT"
            @change="emit('sort', ($event.target as HTMLSelectElement).value as SyncJobSort, order)"
          >
            <option v-for="key in sorts" :key="key" :value="key">
              {{ label(SORT_LABELS[key]) }}
            </option>
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="sync-job-order" class="text-sm font-medium text-gray-800 dark:text-gray-200">
            {{ t('syncJobs.sort.order') }}
          </label>
          <select
            id="sync-job-order"
            :value="order"
            :class="SELECT"
            @change="emit('sort', sort, ($event.target as HTMLSelectElement).value as SortOrder)"
          >
            <option value="asc">{{ t('syncJobs.sort.asc') }}</option>
            <option value="desc">{{ t('syncJobs.sort.desc') }}</option>
          </select>
        </div>
      </template>
    </div>
    <div
      v-show="open"
      :id="panelId"
      class="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-gray-800 dark:bg-gray-900"
    >
      <slot name="pickers" />
      <div class="flex flex-col gap-1.5">
        <label
          for="sync-job-filter-active"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {{ label(texts.active) }}
        </label>
        <select
          id="sync-job-filter-active"
          :value="filters.active ?? ''"
          :class="SELECT"
          @change="emit('update', { active: value($event) as SyncJobListFilters['active'] })"
        >
          <option value="">{{ t('syncJobs.filters.any') }}</option>
          <option value="yes">{{ label(legacy('mailbox.active')) }}</option>
          <option value="no">{{ label(legacy('mailbox.inactive')) }}</option>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="sync-job-filter-running"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {{ label(texts.status) }}
        </label>
        <select
          id="sync-job-filter-running"
          :value="filters.running ?? ''"
          :class="SELECT"
          @change="emit('update', { running: value($event) as SyncJobListFilters['running'] })"
        >
          <option value="">{{ t('syncJobs.filters.any') }}</option>
          <option value="yes">{{ label(texts.running) }}</option>
          <option value="no">{{ label(texts.waiting) }}</option>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="sync-job-filter-result"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {{ label(texts.result) }}
        </label>
        <select
          id="sync-job-filter-result"
          :value="filters.result ?? ''"
          :class="SELECT"
          @change="emit('update', { result: value($event) as SyncJobListFilters['result'] })"
        >
          <option value="">{{ t('syncJobs.filters.any') }}</option>
          <option value="succeeded">{{ t('enums.syncJobLastResult.succeeded') }}</option>
          <option value="failed">{{ t('enums.syncJobLastResult.failed') }}</option>
          <option value="none">{{ t('enums.syncJobLastResult.unknown') }}</option>
        </select>
      </div>
      <div class="flex items-end">
        <button
          type="button"
          :class="buttonVariants({ variant: 'ghost' })"
          :disabled="activeCount === 0"
          @click="emit('clear')"
        >
          {{ t('syncJobs.filters.clear') }}
        </button>
      </div>
    </div>
  </div>
</template>

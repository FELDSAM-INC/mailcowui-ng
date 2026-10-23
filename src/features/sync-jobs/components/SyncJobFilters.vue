<script setup lang="ts">
import FilterPanel from '@/shared/components/FilterPanel.vue'

// The list's filters (FR-009), kept in the feature as UI 002 and UI 003 keep theirs (UI 006 creates
// the shared panel): active state, status and last result for every role, with the classic column
// keys as labels and their values as options. On phones a sort choice offers the table's sorts
// (FR-011). Administrators and domain administrators also filter by owner (the shared
// `MailboxSearchPicker`) and by domain (the shared `DomainPicker`). The search field lives on the
// page.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role } from '@/api'
import { legacy, resolveText, text, type TextRef } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import DomainPicker from '@/shared/components/DomainPicker.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import { buttonVariants } from '@/shared/ui/button'

import { domainSource } from '../domain-source'

import { type SyncJobListFilters, type SyncJobSort } from '../list-state'
import { listTexts } from '../presentation'

const props = defineProps<{
  role: Role
  filters: SyncJobListFilters
  activeCount: number
  sort: SyncJobSort
  order: SortOrder
  showSort?: boolean
}>()
const emit = defineEmits<{
  update: [change: Partial<SyncJobListFilters>]
  clear: []
  sort: [sort: SyncJobSort, order: SortOrder]
}>()
const { t } = useI18n()

const panelId = useId()
const texts = computed(() => listTexts(props.role))
const label = (ref: TextRef) => resolveText(ref, t)

const SELECT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'

/** A single picker's value as a filter value. */
function single(value: string | null | readonly string[]): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function value(event: Event): string | undefined {
  return (event.target as HTMLSelectElement).value || undefined
}
</script>

<template>
  <FilterPanel :id="panelId" :active-count="activeCount" immediate
    ><template v-if="role !== 'mailboxUser'">
      <MailboxSearchPicker
        id="sync-job-filter-mailbox"
        :label="label(legacy('mailbox.owner'))"
        :model-value="filters.mailbox ?? null"
        @update:model-value="(value) => emit('update', { mailbox: single(value) })"
      />
      <DomainPicker
        id="sync-job-filter-domain"
        :label="label(legacy('mailbox.domain'))"
        :sources="[domainSource]"
        :model-value="filters.domain ?? null"
        @update:model-value="(value) => emit('update', { domain: single(value) })"
      />
    </template>
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
        <option value="succeeded">{{ text('enums.syncJobLastResult.succeeded') }}</option>
        <option value="failed">{{ text('enums.syncJobLastResult.failed') }}</option>
        <option value="none">{{ text('enums.syncJobLastResult.unknown') }}</option>
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
    </div></FilterPanel
  >
</template>

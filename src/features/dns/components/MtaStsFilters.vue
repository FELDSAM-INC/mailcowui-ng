<script setup lang="ts">
import FilterPanel from '@/shared/components/FilterPanel.vue'

// The filters of the MTA-STS policies (FR-054): the active state and the mode (raw values, as the
// classic form shows them); the toggle names the number of active filters, one action clears them.

import { useI18n } from 'vue-i18n'

import { mtaStsModeValues, type MtaStsMode } from '@/api'
import { lt } from '@/i18n'

import { buttonVariants } from '@/shared/ui/button'

import type { MtaStsListFilters } from '../mta-sts/list-state'

defineProps<{
  active: MtaStsListFilters['active']
  mode: MtaStsMode | undefined
  activeCount: number
}>()
const emit = defineEmits<{ update: [change: Partial<MtaStsListFilters>]; clear: [] }>()
const { t } = useI18n()

function onActive(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { active: value === '' ? undefined : (value as 'true' | 'false') })
}

function onMode(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { mode: value === '' ? undefined : (value as MtaStsMode) })
}

const SELECT =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <FilterPanel id="mta-sts-filters" :active-count="activeCount" immediate
    ><div class="contents">
      <div class="flex flex-col gap-1.5">
        <label
          for="mta-sts-filter-active"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {{ lt('edit.active') }}
        </label>
        <select id="mta-sts-filter-active" :value="active ?? ''" :class="SELECT" @change="onActive">
          <option value="">{{ t('dns.dkim.filters.all') }}</option>
          <option value="true">{{ lt('mailbox.active') }}</option>
          <option value="false">{{ lt('mailbox.inactive') }}</option>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="mta-sts-filter-mode"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {{ lt('edit.mta_sts_mode') }}
        </label>
        <select id="mta-sts-filter-mode" :value="mode ?? ''" :class="SELECT" @change="onMode">
          <option value="">{{ t('dns.dkim.filters.all') }}</option>
          <option v-for="value in mtaStsModeValues" :key="value" :value="value">
            {{ value }}
          </option>
        </select>
      </div>
    </div>
    <button
      type="button"
      data-clear-filters
      :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
      :disabled="activeCount === 0"
      @click="emit('clear')"
    >
      {{ t('lists.chips.clearAll') }}
    </button></FilterPanel
  >
</template>

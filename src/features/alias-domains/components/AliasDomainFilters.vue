<script setup lang="ts">
import FilterPanel from '@/shared/components/FilterPanel.vue'

// The domain alias list's filters (FR-034): the target domain (legacy's `mailbox.target_domain`
// select with `mailbox.all_domains`, searched by the server) and active. The panel names the number
// of active filters and clears them all.

import { useI18n } from 'vue-i18n'

import { domainPickerSource } from '@/features/aliases-common'
import { lt } from '@/i18n'
import DomainPicker, { type DomainPickerOption } from '@/shared/components/DomainPicker.vue'

import { buttonVariants } from '@/shared/ui/button'

import type { AliasDomainListFilters } from '../list-state'

defineProps<{
  filters: AliasDomainListFilters
  activeCount: number
  labels: Readonly<Record<string, string>>
}>()
const emit = defineEmits<{
  update: [change: Partial<AliasDomainListFilters>]
  clear: []
  pick: [option: DomainPickerOption]
}>()
const { t } = useI18n()

const sources = [domainPickerSource()]

function onActive(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { active: value === '' ? undefined : (value as 'true' | 'false') })
}

const SELECT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <FilterPanel id="alias-domain-filters" :active-count="activeCount" immediate
    ><DomainPicker
      id="alias-domain-filter-target"
      :label="lt('mailbox.target_domain')"
      :placeholder="lt('mailbox.all_domains')"
      :sources="sources"
      :model-value="filters.targetDomain"
      :labels="labels"
      multiple
      @pick="emit('pick', $event)"
      @update:model-value="emit('update', { targetDomain: ($event as string[]) ?? [] })"
    />
    <div class="flex min-w-0 flex-col gap-1.5">
      <label
        for="alias-domain-filter-active"
        class="text-sm font-medium text-gray-800 dark:text-gray-200"
      >
        {{ lt('mailbox.active') }}
      </label>
      <select
        id="alias-domain-filter-active"
        :value="filters.active ?? ''"
        :class="SELECT"
        @change="onActive"
      >
        <option value="">{{ t('lists.filters.all') }}</option>
        <option value="true">{{ t('lists.filters.yes') }}</option>
        <option value="false">{{ t('lists.filters.no') }}</option>
      </select>
    </div>
    <button
      type="button"
      :class="buttonVariants({ variant: 'outline', class: 'self-start md:col-span-full' })"
      :disabled="activeCount === 0"
      @click="emit('clear')"
    >
      {{ t('lists.filters.clear') }}
    </button></FilterPanel
  >
</template>

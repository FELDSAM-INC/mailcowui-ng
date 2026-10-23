<script setup lang="ts">
import FilterPanel from '@/shared/components/FilterPanel.vue'

// The list filters (UI 002 research D8, FR-010): active state, relay and whole tags with
// suggestions from the distinct tags in scope. The control names the number of active filters,
// and one action clears them all.

import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

import { buttonVariants } from '@/shared/ui/button'
import { DOMAIN_TAG_MAX_LENGTH } from '@/shared/validation/limits'

import { useTagSuggestions } from '../../composables/useTagSuggestions'
import type { DomainListFilters } from '../../list-state'
import TagSetInput from '@/shared/components/TagSetInput.vue'

defineProps<{
  active: DomainListFilters['active']
  relay: DomainListFilters['relay']
  tags: readonly string[]
  activeCount: number
}>()
const emit = defineEmits<{ update: [change: Partial<DomainListFilters>]; clear: [] }>()
const { t } = useI18n()

const suggestions = useTagSuggestions()

function onActive(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { active: value === '' ? undefined : (value as DomainListFilters['active']) })
}

function onRelay(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { relay: value === '' ? undefined : (value as DomainListFilters['relay']) })
}
</script>

<template>
  <FilterPanel id="domain-filters" :active-count="activeCount" immediate
    ><div class="contents">
      <div class="flex flex-col gap-1.5">
        <label
          for="domain-filter-active"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {{ t('domains.filters.active') }}
        </label>
        <select
          id="domain-filter-active"
          :value="active ?? ''"
          class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          @change="onActive"
        >
          <option value="">{{ t('lists.filters.all') }}</option>
          <option value="active">{{ lt('mailbox.active') }}</option>
          <option value="inactive">{{ lt('mailbox.inactive') }}</option>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="domain-filter-relay"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {{ t('domains.filters.relay') }}
        </label>
        <select
          id="domain-filter-relay"
          :value="relay ?? ''"
          class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          @change="onRelay"
        >
          <option value="">{{ t('lists.filters.all') }}</option>
          <option value="relay">{{ t('domains.filters.relayOnly') }}</option>
          <option value="local">{{ t('domains.filters.localOnly') }}</option>
        </select>
      </div>
    </div>
    <TagSetInput
      id="domain-filter-tags"
      :label="lt('add.tags')"
      :description="t('domains.filters.tagsHint')"
      :model-value="tags"
      :max-length="DOMAIN_TAG_MAX_LENGTH"
      :suggestions="suggestions.suggestions.value"
      :suggestions-state="suggestions.state.value"
      @search="suggestions.search"
      @update:model-value="emit('update', { tag: $event })"
    />
    <button
      type="button"
      :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
      :disabled="activeCount === 0"
      @click="emit('clear')"
    >
      {{ t('lists.filters.clear') }}
    </button></FilterPanel
  >
</template>

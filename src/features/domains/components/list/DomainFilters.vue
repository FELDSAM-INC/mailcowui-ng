<script setup lang="ts">
// The list filters (UI 002 research D8, FR-010): active state, relay and whole tags with
// suggestions from the distinct tags in scope. The control names the number of active filters,
// and one action clears them all.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { FilterIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { DOMAIN_TAG_MAX_LENGTH } from '@/shared/validation/limits'

import { useTagSuggestions } from '../../composables/useTagSuggestions'
import type { DomainListFilters } from '../../list-state'
import TagSetInput from '../fields/TagSetInput.vue'

const props = defineProps<{
  active: DomainListFilters['active']
  relay: DomainListFilters['relay']
  tags: readonly string[]
  activeCount: number
}>()
const emit = defineEmits<{ update: [change: Partial<DomainListFilters>]; clear: [] }>()
const { t } = useI18n()
const open = ref(props.activeCount > 0)
const suggestions = useTagSuggestions()

const label = computed(() =>
  props.activeCount > 0
    ? t('domains.filters.withCount', { count: props.activeCount })
    : t('domains.filters.title'),
)

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
  <div class="flex flex-col gap-3">
    <button
      type="button"
      :class="
        buttonVariants({ variant: activeCount > 0 ? 'default' : 'outline', class: 'self-start' })
      "
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="domain-filters"
      @click="open = !open"
    >
      <FilterIcon />
      {{ label }}
    </button>
    <div
      v-show="open"
      id="domain-filters"
      class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="flex flex-col gap-4 sm:flex-row">
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
            <option value="">{{ t('domains.filters.all') }}</option>
            <option value="active">{{ t('domains.filters.activeOnly') }}</option>
            <option value="inactive">{{ t('domains.filters.inactiveOnly') }}</option>
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
            <option value="">{{ t('domains.filters.all') }}</option>
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
        {{ t('domains.filters.clear') }}
      </button>
    </div>
  </div>
</template>

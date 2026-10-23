<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import FilterPanel from '@/shared/components/FilterPanel.vue'
import SearchField from '@/shared/components/SearchField.vue'

// Filters of the API key list (FR-064): status and access level as native selects (research R18),
// the owner as the owner picker in free-text mode, and, for the card layout, a sort select. Every
// change goes to the page address through the list state.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { apiKeyAccessLevelValues, apiKeyStatusValues } from '@/api'
import { lt, text } from '@/i18n'
import type { UseListState } from '@/shared/composables/useListState'
import { buttonVariants } from '@/shared/ui/button'

import type { ApiKeyFilters, ApiKeySort } from '../list-state'

const props = defineProps<{
  list: UseListState<ApiKeyFilters, ApiKeySort>
  /** The card layout has no column headers, so it offers the sort here. */
  showSort: boolean
}>()
const { t } = useI18n()
const ids = { status: useId(), access: useId(), owner: useId(), sort: useId() }

const filters = computed(() => props.list.state.value.filters)

function selected(event: Event): string {
  return (event.target as HTMLSelectElement).value
}

function setStatus(event: Event) {
  const value = selected(event)
  void props.list.setFilter(
    'status',
    (apiKeyStatusValues as readonly string[]).includes(value)
      ? (value as ApiKeyFilters['status'])
      : undefined,
  )
}

function setAccess(event: Event) {
  const value = selected(event)
  void props.list.setFilter(
    'access',
    (apiKeyAccessLevelValues as readonly string[]).includes(value)
      ? (value as ApiKeyFilters['access'])
      : undefined,
  )
}

function setOwner(owner: string | null) {
  void props.list.setFilter('owner', owner ?? undefined)
}

function clear() {
  void props.list.setFilters({ owner: undefined, status: undefined, access: undefined })
}

const labelClass = 'text-sm font-medium text-gray-800 dark:text-gray-200'
</script>

<template>
  <ListToolbar
    ><template #filters
      ><FilterPanel
        id="api-keys-filters"
        immediate
        :active-count="list.activeFilters.value.filter((key) => key !== 'owner').length"
        ><div class="grid gap-3 md:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <label :for="ids.status" :class="labelClass">{{ lt('mailbox.status') }}</label>
            <select
              :id="ids.status"
              :value="filters.status ?? ''"
              class="form-control"
              @change="setStatus"
            >
              <option value="">{{ t('apiKeys.filters.allStatuses') }}</option>
              <option v-for="status in apiKeyStatusValues" :key="status" :value="status">
                {{ text(`enums.apiKeyStatus.${status}`) }}
              </option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <label :for="ids.access" :class="labelClass">{{ t('apiKeys.filters.access') }}</label>
            <select
              :id="ids.access"
              :value="filters.access ?? ''"
              class="form-control"
              @change="setAccess"
            >
              <option value="">{{ t('apiKeys.filters.allAccessLevels') }}</option>
              <option v-for="level in apiKeyAccessLevelValues" :key="level" :value="level">
                {{ text(`enums.apiKeyAccessLevel.${level}`) }}
              </option>
            </select>
          </div>
        </div>
        <div v-if="list.activeFilters.value.length > 0" class="flex items-end">
          <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clear">
            {{ t('apiKeys.filters.clear') }}
          </button>
        </div></FilterPanel
      ></template
    ><template #search
      ><SearchField
        id="api-key-owner-search"
        :label="lt('mailbox.owner')"
        :description="t('apiKeys.filters.ownerHint')"
        :model-value="filters.owner ?? ''"
        @search="(value) => setOwner(value || null)" /></template
  ></ListToolbar>
</template>

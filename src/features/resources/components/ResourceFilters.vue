<script setup lang="ts">
// The resource list's filters (FR-043): the domain (legacy's `mailbox.domain` select with
// `mailbox.all_domains`, searched by the server), kind and active. The panel names the number of
// active filters and clears them all.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { resourceKindValues } from '@/api'
import { domainPickerSource } from '@/features/aliases'
import { lt } from '@/i18n'
import DomainPicker, { type DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import MessageText from '@/shared/components/MessageText.vue'
import { FilterIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import type { ResourceListFilters } from '../list-state'

const props = defineProps<{
  filters: ResourceListFilters
  activeCount: number
  labels: Readonly<Record<string, string>>
}>()
const emit = defineEmits<{
  update: [change: Partial<ResourceListFilters>]
  clear: []
  pick: [option: DomainPickerOption]
}>()
const { t } = useI18n()
const open = ref(props.activeCount > 0)
const sources = [domainPickerSource()]

const title = computed(() =>
  props.activeCount > 0
    ? t('lists.filters.withCount', { count: props.activeCount })
    : t('lists.filters.title'),
)

function toggleKind(kind: ResourceListFilters['kind'][number], checked: boolean) {
  const next = checked
    ? [...props.filters.kind, kind]
    : props.filters.kind.filter((item) => item !== kind)
  emit('update', { kind: next })
}

function onActive(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { active: value === '' ? undefined : (value as 'true' | 'false') })
}

const SELECT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div class="flex flex-col gap-3">
    <button
      type="button"
      :class="
        buttonVariants({ variant: activeCount > 0 ? 'default' : 'outline', class: 'self-start' })
      "
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="resource-filters"
      @click="open = !open"
    >
      <FilterIcon />
      {{ title }}
    </button>
    <div
      v-show="open"
      id="resource-filters"
      class="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-3 dark:border-gray-800 dark:bg-gray-900"
    >
      <DomainPicker
        id="resource-filter-domain"
        :label="lt('mailbox.domain')"
        :placeholder="lt('mailbox.all_domains')"
        :sources="sources"
        :model-value="filters.domain"
        :labels="labels"
        multiple
        @pick="emit('pick', $event)"
        @update:model-value="emit('update', { domain: ($event as string[]) ?? [] })"
      />
      <fieldset class="flex min-w-0 flex-col gap-1.5">
        <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ lt('mailbox.kind') }}
        </legend>
        <label
          v-for="kind in resourceKindValues"
          :key="kind"
          class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200"
        >
          <input
            type="checkbox"
            class="size-5 accent-brand-500"
            :checked="filters.kind.includes(kind)"
            @change="toggleKind(kind, ($event.target as HTMLInputElement).checked)"
          />
          <MessageText :k="`enums.resourceKind.${kind}`" />
        </label>
      </fieldset>
      <div class="flex min-w-0 flex-col gap-1.5">
        <label
          for="resource-filter-active"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {{ lt('mailbox.active') }}
        </label>
        <select
          id="resource-filter-active"
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
      </button>
    </div>
  </div>
</template>

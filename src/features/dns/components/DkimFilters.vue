<script setup lang="ts">
// The DKIM list filters (FR-009): the classic interface's state toggles as filter checkboxes
// ("Key unused" for administrators only), the kind ("No domain" for administrators only), the
// completeness, and the selector and domain filters as removable chips. The toggle names the
// number of active filters; one action clears them all. Collapsed until a filter is active.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DkimKeyKind, DkimKeyState, Role } from '@/api'
import { lt, text } from '@/i18n'
import ActiveFilterChips from '@/shared/components/ActiveFilterChips.vue'
import { FilterIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { filterValues, type DkimListFilters } from '../dkim/list-state'

const props = defineProps<{
  role: Role | undefined
  states: readonly DkimKeyState[]
  kind: DkimKeyKind | undefined
  complete: DkimListFilters['complete']
  selector: string | undefined
  domain: string | undefined
  activeCount: number
}>()
const emit = defineEmits<{ update: [change: Partial<DkimListFilters>]; clear: [] }>()
const { t } = useI18n()
const open = ref(props.activeCount > 0)
const values = computed(() => filterValues(props.role))

const label = computed(() =>
  props.activeCount > 0
    ? t('dns.dkim.filters.withCount', { count: props.activeCount })
    : t('dns.dkim.filters.title'),
)

const chips = computed(() => [
  ...(props.selector
    ? [{ key: 'selector', label: t('dns.dkim.filters.selectorChip', { selector: props.selector }) }]
    : []),
  ...(props.domain
    ? [{ key: 'domain', label: t('dns.dkim.filters.domainChip', { domain: props.domain }) }]
    : []),
])

function toggleState(state: DkimKeyState, checked: boolean) {
  const next = checked ? [...props.states, state] : props.states.filter((item) => item !== state)
  emit('update', { state: values.value.states.filter((item) => next.includes(item)) })
}

function onKind(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { kind: value === '' ? undefined : (value as DkimKeyKind) })
}

function onComplete(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { complete: value === '' ? undefined : (value as 'true' | 'false') })
}

function removeChip(key: string) {
  emit('update', key === 'selector' ? { selector: undefined } : { domain: undefined })
}

const SELECT =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div class="flex flex-col gap-3">
    <button
      type="button"
      :class="
        buttonVariants({ variant: activeCount > 0 ? 'default' : 'outline', class: 'self-start' })
      "
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="dkim-filters"
      @click="open = !open"
    >
      <FilterIcon />
      {{ label }}
    </button>
    <div
      v-show="open"
      id="dkim-filters"
      class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ lt('mailbox.status') }}
        </legend>
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          <label
            v-for="state in values.states"
            :key="state"
            class="inline-flex min-h-11 items-center gap-2 text-gray-800 dark:text-gray-200"
          >
            <input
              type="checkbox"
              :value="state"
              :checked="states.includes(state)"
              class="size-5 rounded border-gray-300"
              @change="toggleState(state, ($event.target as HTMLInputElement).checked)"
            />
            {{ text(`dns.dkim.states.${state}`) }}
          </label>
        </div>
      </fieldset>
      <div class="flex flex-col gap-4 sm:flex-row">
        <div class="flex flex-col gap-1.5">
          <label
            for="dkim-filter-kind"
            class="text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            {{ t('dns.dkim.filters.kind') }}
          </label>
          <select id="dkim-filter-kind" :value="kind ?? ''" :class="SELECT" @change="onKind">
            <option value="">{{ t('dns.dkim.filters.all') }}</option>
            <option v-for="value in values.kinds" :key="value" :value="value">
              {{ text(`dns.dkim.kinds.${value}`) }}
            </option>
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <label
            for="dkim-filter-complete"
            class="text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            {{ t('dns.dkim.filters.complete') }}
          </label>
          <select
            id="dkim-filter-complete"
            :value="complete ?? ''"
            :class="SELECT"
            @change="onComplete"
          >
            <option value="">{{ t('dns.dkim.filters.all') }}</option>
            <option value="true">{{ t('dns.dkim.filters.completeOnly') }}</option>
            <option value="false">{{ t('dns.dkim.filters.incompleteOnly') }}</option>
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
      </button>
    </div>
    <ActiveFilterChips
      v-if="chips.length > 0"
      data-filter-chips
      :chips="chips"
      @remove="removeChip"
      @clear="emit('update', { selector: undefined, domain: undefined })"
    />
  </div>
</template>

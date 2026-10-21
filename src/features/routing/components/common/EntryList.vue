<script setup lang="ts" generic="T">
// One page of a routing list (research R4, FR-005): cards with every column below md, a table
// with the classic columns from md up, sortable headers with `aria-sort`, selection checkboxes
// only in selection mode, and the entry's actions. The primary column (the first by default)
// names the entry: the card's heading, and in both layouts a link to its page when it has one.
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { EntryColumn } from './entry-list'

const props = withDefaults(
  defineProps<{
    entries: readonly T[]
    columns: readonly EntryColumn<T>[]
    idOf: (entry: T) => string
    /** The page of an entry, linked from its first column. */
    editTo?: (entry: T) => RouteLocationRaw | null
    caption: string
    actionsLabel: string
    /** The key of the column that names the entry. */
    primary?: string
    sort?: string
    order?: SortOrder
    selectable?: boolean
  }>(),
  { editTo: undefined, primary: undefined, sort: undefined, order: 'asc', selectable: false },
)
const emit = defineEmits<{ sort: [sort: string, order: SortOrder] }>()
const wide = useMediaQuery('(min-width: 768px)')

const first = computed(
  () => props.columns.find((column) => column.key === props.primary) ?? props.columns[0]!,
)
const rest = computed(() => props.columns.filter((column) => column !== first.value))
const domId = (entry: T) => `entry-${props.idOf(entry).replace(/[^A-Za-z0-9_-]/g, '_')}`

function ariaSort(column: EntryColumn<T>) {
  if (!column.sort || column.sort !== props.sort) return column.sort ? 'none' : undefined
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(column: EntryColumn<T>) {
  if (!column.sort) return
  emit('sort', column.sort, column.sort === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const LINK =
  'inline-flex min-h-11 min-w-11 items-center font-semibold wrap-anywhere text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white'
</script>

<template>
  <div v-if="wide" class="table-frame">
    <table class="data-table w-full table-auto text-sm">
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-3 py-2">
            <slot name="select-all" />
          </th>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            class="px-3 py-2 text-start"
            :aria-sort="ariaSort(column)"
            :data-column="column.key"
          >
            <button
              v-if="column.sort"
              type="button"
              class="inline-flex min-h-11 min-w-11 items-center gap-1 hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column)"
            >
              {{ column.label }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
            <template v-else>{{ column.label }}</template>
          </th>
          <th v-if="$slots.actions" scope="col" class="table-controls-cell px-3 py-2 text-end">
            {{ actionsLabel }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr v-for="entry in entries" :key="idOf(entry)" :data-entry="idOf(entry)" class="align-top">
          <td v-if="selectable" class="px-3 py-3"><slot name="select" :entry="entry" /></td>
          <td
            v-for="column in columns"
            :key="column.key"
            :data-column="column.key"
            class="max-w-72 px-3 py-3 wrap-anywhere text-gray-900 dark:text-white"
          >
            <slot :name="`cell-${column.key}`" :entry="entry">
              <RouterLink
                v-if="column === first && editTo?.(entry)"
                :to="editTo(entry)!"
                :class="LINK"
              >
                {{ column.text?.(entry) }}
              </RouterLink>
              <template v-else>{{ column.text?.(entry) }}</template>
            </slot>
          </td>
          <td v-if="$slots.actions" class="table-controls-cell px-3 py-3">
            <RowControls><slot name="actions" :entry="entry" /></RowControls>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ul v-else :aria-label="caption" class="flex flex-col gap-3">
    <li
      v-for="entry in entries"
      :key="idOf(entry)"
      :data-entry="idOf(entry)"
      class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <article :aria-labelledby="`${domId(entry)}-name`" class="flex flex-col gap-3">
        <div class="flex items-start gap-3">
          <slot v-if="selectable" name="select" :entry="entry" />
          <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the slot or link is its content -->
          <h3
            :id="`${domId(entry)}-name`"
            class="min-w-0 flex-1 text-base font-semibold wrap-anywhere text-gray-900 dark:text-white"
          >
            <slot :name="`cell-${first.key}`" :entry="entry">
              <RouterLink v-if="editTo?.(entry)" :to="editTo(entry)!" :class="LINK">
                {{ first.text?.(entry) }}
              </RouterLink>
              <template v-else>{{ first.text?.(entry) }}</template>
            </slot>
          </h3>
        </div>
        <dl class="grid grid-cols-1 gap-y-1 text-sm">
          <div
            v-for="column in rest"
            :key="column.key"
            :data-column="column.key"
            class="flex flex-wrap gap-x-1"
          >
            <dt class="text-gray-600 dark:text-gray-400">{{ column.label }}:</dt>
            <dd class="min-w-0 wrap-anywhere text-gray-900 dark:text-white">
              <slot :name="`cell-${column.key}`" :entry="entry">{{ column.text?.(entry) }}</slot>
            </dd>
          </div>
        </dl>
        <slot name="actions" :entry="entry" />
      </article>
    </li>
  </ul>
</template>

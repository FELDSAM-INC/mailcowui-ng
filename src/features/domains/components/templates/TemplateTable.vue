<script setup lang="ts">
// The templates as a table from md up (FR-050, FR-049, FR-072), with the classic list's columns
// (`js/site/mailbox.js` draw_templates_domain_table): ID and template sortable from their headers
// with `aria-sort`, then the limits, quotas, Global Address List, relay options, active state and
// the actions. As in the classic responsive table, narrower screens move columns into the entry's
// details, which also hold the rate limit, selector, key length and tags. Slots: `select-all`,
// `select` and `actions`.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { legacy, lt, resolveText, type TextRef } from '@/i18n'
import type { DomainTemplate } from '@/api'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import RowControls from '@/shared/components/RowControls.vue'

import { useDomainFormat } from '../../format'
import type { TemplateSort } from '../../templates-list-state'
import DefaultBadge from './DefaultBadge.vue'
import { templateColumns } from './template-columns'
import TemplateEntryDetails from './TemplateEntryDetails.vue'

const props = withDefaults(
  defineProps<{
    templates: readonly DomainTemplate[]
    sort: TemplateSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: TemplateSort, order: SortOrder] }>()
const { t } = useI18n()
const format = useDomainFormat()
const xl = useMediaQuery('(min-width: 1280px)')
const xxl = useMediaQuery('(min-width: 1536px)')
const expanded = ref(new Set<number>())

const all = computed(() => templateColumns(format))
const shown = (from: 'md' | 'xl' | '2xl') => from === 'md' || (from === 'xl' ? xl.value : xxl.value)
const columns = computed(() => all.value.filter((column) => shown(column.from)))
const hidden = computed(() =>
  all.value.filter((column) => !shown(column.from)).map((column) => column.key),
)

function ariaSort(key: TemplateSort) {
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(key: TemplateSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

function toggle(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

const SORTABLE: readonly { key: 'id' | 'name'; label: TextRef }[] = [
  { key: 'id', label: 'lists.id' },
  { key: 'name', label: legacy('mailbox.template') },
]
const columnCount = computed(() => columns.value.length + 3 + (props.selectable ? 1 : 0))
</script>

<template>
  <div class="table-frame">
    <table class="data-table w-full table-auto text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.domain_templates')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-3 py-2"><slot name="select-all" /></th>
          <th
            v-for="column in SORTABLE"
            :key="column.key"
            scope="col"
            class="px-3 py-2 text-start"
            :aria-sort="ariaSort(column.key)"
          >
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-1 hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.key)"
            >
              {{ resolveText(column.label, t) }}
              <span aria-hidden="true">{{
                sort === column.key ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
          </th>
          <th v-for="column in columns" :key="column.key" scope="col" class="px-3 py-2 text-start">
            {{ column.label }}
          </th>
          <th scope="col" class="table-controls-cell px-3 py-2 text-end">
            {{ lt('mailbox.action') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="template in templates" :key="template.id">
          <tr :data-entry="template.id" class="align-top">
            <td v-if="selectable" class="px-3 py-3"><slot name="select" :template="template" /></td>
            <td class="px-3 py-3 text-gray-900 dark:text-white">{{ template.id }}</td>
            <td class="max-w-64 px-3 py-3">
              <div class="flex flex-col items-start gap-1">
                <RouterLink
                  :to="{ name: 'domain-template-detail', params: { templateId: template.id } }"
                  class="inline-flex min-h-11 min-w-0 items-center font-semibold break-words text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
                >
                  {{ template.name }}
                </RouterLink>
                <DefaultBadge v-if="template.isDefault" />
              </div>
            </td>
            <td
              v-for="column in columns"
              :key="column.key"
              :data-column="column.key"
              class="px-3 py-3 text-gray-900 dark:text-white"
            >
              {{ column.value(template) }}
            </td>
            <td class="table-controls-cell px-3 py-3">
              <RowControls
                :expanded="expanded.has(template.id)"
                :controls="`template-row-${template.id}-details`"
                :label="t('domainTemplates.list.detailsOf', { name: template.name })"
                @toggle="toggle(template.id)"
              >
                <slot name="actions" :template="template" />
              </RowControls>
            </td>
          </tr>
          <tr v-if="expanded.has(template.id)" :id="`template-row-${template.id}-details`">
            <td
              :colspan="columnCount"
              class="bg-gray-50 px-3 py-3 dark:bg-gray-950"
              :data-entry-details="template.id"
            >
              <TemplateEntryDetails :template="template" :hidden="hidden" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

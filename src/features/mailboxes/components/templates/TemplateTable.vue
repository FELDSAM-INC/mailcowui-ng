<script setup lang="ts">
import DataIdentity from '@/shared/components/DataIdentity.vue'

import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

// The mailbox templates as a table from md up (FR-058, FR-072), with the classic list's columns
// (`js/site/mailbox.js` draw_templates_mbox_table): ID and template sortable from their headers
// with `aria-sort`, then quota, TLS in and out, the six protocols, SOGo, forced 2FA, the active
// state and the actions. As in the classic responsive table, narrower screens move columns into
// the entry's details, which also hold the child row's values. Slots: `select-all`, `select` and
// `actions`.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { legacy, lt, resolveText, type TextRef } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'

import RowControls from '@/shared/components/RowControls.vue'

import { useTemplateDisplay } from '../../templates/display'
import type { TemplateSort } from '../../templates/list-state'
import type { MailboxTemplate } from '../../types'
import MailboxStatusBadge from '../display/MailboxStatusBadge.vue'
import DefaultBadge from './DefaultBadge.vue'
import TemplateEntryDetails from './TemplateEntryDetails.vue'

const props = withDefaults(
  defineProps<{
    hidden?: boolean
    templates: readonly MailboxTemplate[]
    sort: TemplateSort
    order: SortOrder
    selectable?: boolean
    /** The actions column; domain administrators have no actions (FR-063). */
    actions?: boolean
  }>(),
  { selectable: false, actions: true },
)
const emit = defineEmits<{ sort: [sort: TemplateSort, order: SortOrder] }>()
const { t } = useI18n()
const display = useTemplateDisplay()

const expanded = ref(new Set<number>())

const all = computed(() => display.columns())

const columns = computed(() => all.value)
const hiddenColumns = computed(() =>
  all.value.filter((column) => !tableView.visible(column.key)).map((column) => column.key),
)

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

const tableView = useDataColumns(
  () => [
    ...SORTABLE.map((column) => ({
      id: column.key,
      label: resolveText(column.label, t),
      sort: column.key,
    })),
    ...columns.value.map((column) => ({
      id: column.key,
      label: column.label,
      defaultVisible: column.from === 'md',
    })),
  ],
  () => ({
    key: props.sort,
    order: props.order,
    change: (key) => sortBy(key as Parameters<typeof sortBy>[0]),
  }),
)
</script>

<template>
  <div v-if="!hidden" class="table-frame">
    <table class="data-table w-full table-auto text-sm">
      <caption class="sr-only">
        {{
          lt('mailbox.mailbox_templates')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-3 py-2"><slot name="select-all" /></th>
          <DataTableHeader
            v-for="column in SORTABLE"
            :key="column.key"
            :column="String(column.key)"
            class="px-3 py-2 text-start"
          />
          <DataTableHeader
            v-for="column in columns"
            :key="column.key"
            :column="String(column.key)"
            class="px-3 py-2 text-start"
          />

          <th scope="col" class="table-controls-cell px-3 py-2 text-end">
            {{ actions ? lt('mailbox.action') : t('domains.list.details') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="template in templates" :key="template.id">
          <tr :data-entry="template.id" class="align-top">
            <td v-if="selectable" class="px-3 py-3"><slot name="select" :template="template" /></td>
            <td
              v-show="tableView.visible(String('id'))"
              :data-column="String('id')"
              class="px-3 py-3 text-gray-900 dark:text-white"
            >
              {{ template.id }}
            </td>
            <td
              v-show="tableView.visible(String('name'))"
              :data-column="String('name')"
              class="max-w-64 px-3 py-3"
            >
              <DataIdentity
                ><RouterLink
                  :to="{ name: 'mailbox-template-detail', params: { templateId: template.id } }"
                  class="inline-flex min-h-11 min-w-11 items-center font-semibold break-words text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
                >
                  {{ template.name }} </RouterLink
                ><template #badges
                  ><DefaultBadge v-if="template.isDefault" /><MailboxStatusBadge
                    :status="template.status" /></template
              ></DataIdentity>
            </td>
            <td
              v-for="column in columns"
              v-show="tableView.visible(String(column.key))"
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
                <slot v-if="actions" name="actions" :template="template" />
              </RowControls>
            </td>
          </tr>
          <tr v-if="expanded.has(template.id)" :id="`template-row-${template.id}-details`">
            <td
              :colspan="columnCount - tableView.columns.value.length + tableView.visibleCount.value"
              class="bg-gray-50 px-3 py-3 dark:bg-gray-950"
              :data-entry-details="template.id"
            >
              <TemplateEntryDetails :template="template" :hidden="hiddenColumns" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

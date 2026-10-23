<script setup lang="ts">
import DataRow from '@/shared/components/DataRow.vue'

import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
// Legacy's column order on wide screens; subject headings and a details disclosure on phones.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuarantineItem } from '@/api'
import { lt, text } from '@/i18n'
import PlainText from '@/shared/components/PlainText.vue'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import { type QuarantineSort } from '../../list-state'
import QuarantineItemValue from './QuarantineItemValue.vue'

const props = defineProps<{
  items: readonly QuarantineItem[]
  scoped: boolean
  sort: QuarantineSort
  order: SortOrder
  canRemove: boolean
  busy: boolean
  selectable?: boolean
}>()
const emit = defineEmits<{
  sort: [sort: QuarantineSort, order: SortOrder]
  remove: [item: QuarantineItem]
}>()
const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const columns = computed<QuarantineSort[]>(() => [
  'id',
  'queueId',
  'sender',
  'subject',
  'action',
  ...(props.scoped ? ['recipient' as const] : []),
  'virus',
  'score',
  'notified',
  'arrivedAt',
])
// Wide data columns have room for addresses/subjects; compact scalar columns keep their share small.

const cardSummary: QuarantineSort[] = ['sender', 'action', 'score', 'arrivedAt']
const cardDetails = computed(() =>
  columns.value.filter((field) => field !== 'subject' && !cardSummary.includes(field)),
)
const label = (field: QuarantineSort) =>
  field === 'id' ? t('lists.id') : text(`quarantineUi.sort.${field}`)
const itemRoute = (item: QuarantineItem) => ({
  name: 'quarantine-item',
  params: { itemId: item.id },
})

const tableView = useDataColumns(
  () => columns.value.map((id) => ({ id, label: label(id), sort: id })),
  () => ({
    key: props.sort,
    order: props.order,
    change: (key, order) => emit('sort', key as QuarantineSort, order),
  }),
)
</script>

<template>
  <div v-if="wide" class="table-frame">
    <table
      :aria-label="lt('quarantine.quarantine')"
      class="data-table w-full table-fixed text-start text-sm"
      :class="scoped ? 'min-w-[85rem]' : 'min-w-[76rem]'"
    >
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-800">
          <th v-if="selectable" scope="col" class="w-11">
            <span class="sr-only">{{ t('bulk.select') }}</span>
          </th>
          <DataTableHeader v-for="field in columns" :key="field" :column="field" />
          <th scope="col" class="table-controls-cell px-2 text-end">
            {{ lt('quarantine.action') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <DataRow
          v-for="item in items"
          :key="item.id"
          :to="itemRoute(item)"
          :label="item.subject || String(item.id)"
          :data-quarantine-item="item.id"
          class="border-b border-gray-200 align-top dark:border-gray-800"
        >
          <td v-if="selectable"><slot name="select" :item="item" /></td>
          <td
            v-for="field in columns"
            v-show="tableView.visible(field)"
            :key="field"
            :data-column="field"
            class="px-2 py-3 wrap-anywhere text-gray-800 dark:text-gray-200"
            :class="['queueId', 'id', 'score'].includes(field) ? 'whitespace-nowrap' : ''"
          >
            <span v-if="field === 'subject'" class="font-medium wrap-anywhere"
              ><PlainText :value="item.subject || '-'"
            /></span>
            <QuarantineItemValue v-else :item="item" :field="field" />
          </td>
          <td class="table-controls-cell px-2 py-3">
            <RowControls>
              <RowActions
                v-slot="{ menu }"
                :count="canRemove ? 2 : 1"
                :label="`${lt('quarantine.action')}: ${item.id}`"
              >
                <RowAction
                  :menu="menu"
                  :to="itemRoute(item)"
                  :label="lt('quarantine.show_item')"
                  :aria-label="`${lt('quarantine.show_item')}: ${item.id}`"
                />
                <RowAction
                  v-if="canRemove"
                  :menu="menu"
                  :disabled="busy"
                  destructive
                  :label="lt('quarantine.remove')"
                  :aria-label="`${lt('quarantine.remove')}: ${item.id}`"
                  @select="emit('remove', item)"
                />
              </RowActions>
            </RowControls>
          </td>
        </DataRow>
      </tbody>
    </table>
  </div>
  <ul v-else :aria-label="lt('quarantine.quarantine')" class="flex flex-col gap-3">
    <DataCard
      v-for="item in items"
      :key="item.id"
      :data-quarantine-item="item.id"
      :to="itemRoute(item)"
    >
      <template #title><PlainText :value="item.subject || '-'" /></template>
      <template v-if="selectable" #select><slot name="select" :item="item" /></template>
      <template #actions>
        <RowActions
          v-slot="{ menu }"
          :count="canRemove ? 2 : 1"
          :label="`${lt('quarantine.action')}: ${item.id}`"
        >
          <RowAction
            :menu="menu"
            :to="itemRoute(item)"
            :label="lt('quarantine.show_item')"
            :aria-label="`${lt('quarantine.show_item')}: ${item.id}`"
          />
          <RowAction
            v-if="canRemove"
            :menu="menu"
            :disabled="busy"
            destructive
            :label="lt('quarantine.remove')"
            :aria-label="`${lt('quarantine.remove')}: ${item.id}`"
            @select="emit('remove', item)"
          />
        </RowActions>
      </template>
      <DataCardFields>
        <template v-for="field in cardSummary" :key="field">
          <dt class="font-medium text-gray-800 dark:text-gray-200">{{ label(field) }}</dt>
          <dd class="min-w-0 wrap-anywhere text-gray-700 dark:text-gray-300">
            <QuarantineItemValue :item="item" :field="field" />
          </dd>
        </template>
      </DataCardFields>
      <template v-if="cardDetails.length" #details>
        <DataCardFields>
          <template v-for="field in cardDetails" :key="field">
            <dt class="font-medium text-gray-800 dark:text-gray-200">{{ label(field) }}</dt>
            <dd class="min-w-0 wrap-anywhere text-gray-700 dark:text-gray-300">
              <QuarantineItemValue :item="item" :field="field" />
            </dd>
          </template>
        </DataCardFields>
      </template>
    </DataCard>
  </ul>
</template>

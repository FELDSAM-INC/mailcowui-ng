<script setup lang="ts">
// Legacy's column order on wide screens; subject headings and a details disclosure on phones.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { QuarantineItem } from '@/api'
import { lt, text } from '@/i18n'
import PlainText from '@/shared/components/PlainText.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'

import { defaultOrder, type QuarantineSort } from '../../list-state'
import QuarantineCardDetails from './QuarantineCardDetails.vue'
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
const columnWidths: Partial<Record<QuarantineSort, string>> = {
  id: 'w-12',
  queueId: 'w-28',
  sender: 'w-36',
  subject: 'w-48',
  action: 'w-24',
  recipient: 'w-36',
  virus: 'w-24',
  score: 'w-14',
  notified: 'w-20',
  arrivedAt: 'w-32',
}
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
function sortBy(field: QuarantineSort) {
  emit(
    'sort',
    field,
    field === props.sort ? (props.order === 'asc' ? 'desc' : 'asc') : defaultOrder(field),
  )
}
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
          <th
            v-for="field in columns"
            :key="field"
            scope="col"
            :class="columnWidths[field]"
            class="px-2 text-start align-bottom"
            :aria-sort="field === sort ? (order === 'asc' ? 'ascending' : 'descending') : 'none'"
          >
            <button
              type="button"
              class="min-h-11 w-full break-words text-start focus-visible:outline-2 focus-visible:outline-brand-500"
              @click="sortBy(field)"
            >
              {{ label(field) }}
            </button>
          </th>
          <th scope="col" class="w-48 px-2 text-start">
            {{ lt('quarantine.action') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          :data-quarantine-item="item.id"
          class="border-b border-gray-200 align-top dark:border-gray-800"
        >
          <td v-if="selectable"><slot name="select" :item="item" /></td>
          <td
            v-for="field in columns"
            :key="field"
            class="px-2 py-3 wrap-anywhere text-gray-800 dark:text-gray-200"
            :class="['queueId', 'id', 'score'].includes(field) ? 'whitespace-nowrap' : ''"
          >
            <RouterLink
              v-if="field === 'subject'"
              :to="itemRoute(item)"
              class="inline-flex min-h-11 min-w-11 items-center text-accent-text bg-white dark:bg-gray-900 underline"
              ><PlainText :value="item.subject || '-'"
            /></RouterLink>
            <QuarantineItemValue v-else :item="item" :field="field" />
          </td>
          <td class="px-2 py-3">
            <div class="table-actions flex flex-col items-start gap-2">
              <RouterLink
                :to="itemRoute(item)"
                :class="
                  buttonVariants({
                    variant: 'outline',
                    class: 'h-auto min-h-11 max-w-full whitespace-normal',
                  })
                "
                >{{ lt('quarantine.show_item') }}</RouterLink
              >
              <button
                v-if="canRemove"
                type="button"
                :disabled="busy"
                :class="
                  buttonVariants({
                    variant: 'outline',
                    class: 'h-auto min-h-11 max-w-full whitespace-normal',
                  })
                "
                @click="emit('remove', item)"
              >
                {{ lt('quarantine.remove') }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ul v-else :aria-label="lt('quarantine.quarantine')" class="flex flex-col gap-3">
    <li
      v-for="item in items"
      :key="item.id"
      :data-quarantine-item="item.id"
      class="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <div v-if="selectable" class="flex items-center gap-2">
        <slot name="select" :item="item" />
        <span aria-hidden="true">{{ t('bulk.select') }}</span>
      </div>
      <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- PlainText provides the link's visible, accessible subject. -->
      <h2 class="font-semibold">
        <RouterLink
          :to="itemRoute(item)"
          class="inline-flex min-h-11 min-w-11 max-w-full items-center text-accent-text bg-white dark:bg-gray-900 underline"
          ><PlainText :value="item.subject || '-'"
        /></RouterLink>
      </h2>
      <dl class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-2 text-sm">
        <template v-for="field in cardSummary" :key="field">
          <dt class="font-medium text-gray-800 dark:text-gray-200">{{ label(field) }}</dt>
          <dd class="min-w-0 wrap-anywhere text-gray-700 dark:text-gray-300">
            <QuarantineItemValue :item="item" :field="field" />
          </dd>
        </template>
      </dl>
      <QuarantineCardDetails>
        <dl class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-2 text-sm">
          <template v-for="field in cardDetails" :key="field">
            <dt class="font-medium text-gray-800 dark:text-gray-200">{{ label(field) }}</dt>
            <dd class="min-w-0 wrap-anywhere text-gray-700 dark:text-gray-300">
              <QuarantineItemValue :item="item" :field="field" />
            </dd>
          </template>
        </dl>
      </QuarantineCardDetails>
      <div class="mt-3 flex flex-wrap gap-2">
        <RouterLink :to="itemRoute(item)" :class="buttonVariants({ variant: 'outline' })">{{
          lt('quarantine.show_item')
        }}</RouterLink>
        <button
          v-if="canRemove"
          type="button"
          :disabled="busy"
          :class="buttonVariants({ variant: 'outline' })"
          @click="emit('remove', item)"
        >
          {{ lt('quarantine.remove') }}
        </button>
      </div>
    </li>
  </ul>
</template>

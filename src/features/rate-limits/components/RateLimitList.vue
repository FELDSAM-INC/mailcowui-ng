<script setup lang="ts">
import DataRow from '@/shared/components/DataRow.vue'

import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
// The limits of the Rate limits overview (FR-056, legacy form map screen 7): a table from md up
// with the columns `rateLimits.list.object`, `mailbox.kind` and `edit.ratelimit` (object and kind
// sortable, with `aria-sort`), and cards below md. The limit reads as the sections show it ("100
// msgs / hour"), a stored value in an invalid format with its text. Each entry opens its object's
// page at the rate limit section (`mailbox.edit`), where its History remains available.
import { useI18n } from 'vue-i18n'

import type { RateLimit } from '@/api'
import { lt, text } from '@/i18n'
import { DEFAULT_LOCALE, isAppLocale } from '@/i18n/locales'
import PlainText from '@/shared/components/PlainText.vue'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { WarningIcon } from '@/shared/icons'

import { hostLocation } from '../host'
import type { RateLimitSort } from '../list-state'
import { formatLimit, invalidStoredText } from '../rate-limit'

const props = defineProps<{
  items: readonly RateLimit[]
  wide: boolean
  sort: RateLimitSort
  order: SortOrder
}>()
const emit = defineEmits<{ sort: [sort: RateLimitSort, order: SortOrder] }>()
const { t, locale } = useI18n()

const appLocale = () => (isAppLocale(locale.value) ? locale.value : DEFAULT_LOCALE)
const kindLabel = (item: RateLimit) => text(`enums.rateLimitObjectKind.${item.kind}`)
const limitText = (item: RateLimit) =>
  item.invalidStoredValue === null ? formatLimit(item.limit, appLocale()) : null
const header = (key: RateLimitSort) =>
  key === 'object' ? t('rateLimits.list.object') : lt('mailbox.kind')

const entryKey = (item: RateLimit) => `${item.kind}:${item.object}`

const tableView = useDataColumns(
  () => [
    { id: 'object', label: header('object'), sort: 'object' },
    { id: 'kind', label: header('kind'), sort: 'kind' },
    { id: 'limit', label: lt('edit.ratelimit') },
  ],
  () => ({
    key: props.sort,
    order: props.order,
    change: (key, order) => emit('sort', key as RateLimitSort, order),
  }),
)
</script>

<template>
  <div v-if="wide" data-rate-limit-table class="table-frame">
    <table class="data-table w-full table-fixed text-start text-sm">
      <thead>
        <tr>
          <DataTableHeader
            v-for="column in tableView.columns.value"
            :key="column.id"
            :column="column.id"
          />

          <th scope="col" class="table-controls-cell px-3 py-2 text-end">
            <span class="sr-only">{{ lt('mailbox.action') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <DataRow
          v-for="item in items"
          :key="entryKey(item)"
          :to="hostLocation(item.kind, item.object)"
          :label="item.object"
          :data-entry="entryKey(item)"
        >
          <td
            v-show="tableView.visible('object')"
            :data-column="'object'"
            class="px-3 py-2 font-medium break-all text-gray-900 dark:text-white"
          >
            <PlainText :value="item.object" />
          </td>
          <td
            v-show="tableView.visible('kind')"
            :data-column="'kind'"
            class="px-3 py-2 text-gray-900 dark:text-white"
          >
            {{ kindLabel(item) }}
          </td>
          <td
            v-show="tableView.visible('limit')"
            :data-column="'limit'"
            class="px-3 py-2 break-words text-gray-900 dark:text-white"
          >
            <template v-if="limitText(item) !== null">{{ limitText(item) }}</template>
            <span
              v-else
              data-invalid-stored
              class="inline-flex gap-1 text-amber-900 dark:text-amber-100"
            >
              <WarningIcon class="mt-0.5 size-4 shrink-0" />
              <span class="min-w-0">
                {{ invalidStoredText(item.invalidStoredValue!) }}
              </span>
            </span>
          </td>
          <td class="table-controls-cell px-3 py-2">
            <RowControls>
              <RowActions
                v-slot="{ menu }"
                :count="1"
                :label="`${lt('mailbox.action')}: ${item.object}`"
              >
                <RowAction
                  :menu="menu"
                  :to="hostLocation(item.kind, item.object)"
                  :label="lt('mailbox.edit')"
                  :aria-label="`${lt('mailbox.edit')}: ${item.object}`"
                />
              </RowActions>
            </RowControls>
          </td>
        </DataRow>
      </tbody>
    </table>
  </div>
  <ul v-else data-rate-limit-cards :aria-label="t('rateLimits.title')" class="flex flex-col gap-3">
    <DataCard
      v-for="item in items"
      :key="entryKey(item)"
      :to="hostLocation(item.kind, item.object)"
      :data-entry="entryKey(item)"
      :title="item.object"
    >
      <template #title><PlainText :value="item.object" /></template>
      <template #actions>
        <RowActions v-slot="{ menu }" :count="1" :label="`${lt('mailbox.action')}: ${item.object}`">
          <RowAction
            :menu="menu"
            :to="hostLocation(item.kind, item.object)"
            :label="lt('mailbox.edit')"
            :aria-label="`${lt('mailbox.edit')}: ${item.object}`"
          />
        </RowActions>
      </template>
      <DataCardFields>
        <div>
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.kind') }}</dt>
          <dd class="text-gray-900 dark:text-white">{{ kindLabel(item) }}</dd>
        </div>
        <div>
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.ratelimit') }}</dt>
          <dd class="break-words text-gray-900 dark:text-white">
            <template v-if="limitText(item) !== null">{{ limitText(item) }}</template>
            <span
              v-else
              data-invalid-stored
              class="inline-flex gap-1 text-amber-900 dark:text-amber-100"
            >
              <WarningIcon class="mt-0.5 size-4 shrink-0" />
              <span class="min-w-0">
                {{ invalidStoredText(item.invalidStoredValue!) }}
              </span>
            </span>
          </dd>
        </div>
      </DataCardFields>
    </DataCard>
  </ul>
</template>

<script setup lang="ts">
// The limits of the Rate limits overview (FR-056, legacy form map screen 7): a table from md up
// with the columns `rateLimits.list.object`, `mailbox.kind` and `edit.ratelimit` (object and kind
// sortable, with `aria-sort`), and cards below md. The limit reads as the sections show it ("100
// msgs / hour"), a stored value in an invalid format with its text. Each entry opens its object's
// page at the rate limit section (`mailbox.edit`), where its History remains available.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { RateLimit } from '@/api'
import { lt, text } from '@/i18n'
import { DEFAULT_LOCALE, isAppLocale } from '@/i18n/locales'
import PlainText from '@/shared/components/PlainText.vue'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { ChevronDownIcon, WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

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
const SORTABLE: RateLimitSort[] = ['object', 'kind']

function ariaSort(key: RateLimitSort) {
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function onSort(key: RateLimitSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const entryKey = (item: RateLimit) => `${item.kind}:${item.object}`
</script>

<template>
  <div v-if="wide" data-rate-limit-table class="table-frame">
    <table class="data-table w-full table-fixed text-start text-sm">
      <thead>
        <tr>
          <th
            v-for="key in SORTABLE"
            :key="key"
            scope="col"
            class="px-3 py-2 text-start"
            :class="key === 'object' ? 'w-1/3' : ''"
            :aria-sort="ariaSort(key)"
          >
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start"
              @click="onSort(key)"
            >
              {{ header(key) }}
              <ChevronDownIcon
                v-if="key === sort"
                class="size-4"
                :class="order === 'asc' ? 'rotate-180' : ''"
              />
            </button>
          </th>
          <th scope="col" class="px-3 py-2 text-start">{{ lt('edit.ratelimit') }}</th>
          <th scope="col" class="table-controls-cell px-3 py-2 text-end">
            <span class="sr-only">{{ lt('mailbox.action') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr v-for="item in items" :key="entryKey(item)" :data-entry="entryKey(item)">
          <td class="px-3 py-2 font-medium break-all text-gray-900 dark:text-white">
            <PlainText :value="item.object" />
          </td>
          <td class="px-3 py-2 text-gray-900 dark:text-white">{{ kindLabel(item) }}</td>
          <td class="px-3 py-2 break-words text-gray-900 dark:text-white">
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
        </tr>
      </tbody>
    </table>
  </div>
  <ul v-else data-rate-limit-cards :aria-label="t('rateLimits.title')" class="flex flex-col gap-3">
    <li
      v-for="item in items"
      :key="entryKey(item)"
      :data-entry="entryKey(item)"
      class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- PlainText renders the accessible object name. -->
      <h2 class="text-base font-semibold break-all text-gray-900 dark:text-white">
        <PlainText :value="item.object" />
      </h2>
      <dl class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
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
      </dl>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          :to="hostLocation(item.kind, item.object)"
          :class="buttonVariants({ variant: 'outline' })"
        >
          {{ lt('mailbox.edit') }}
        </RouterLink>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
// The keys as a table, from the md breakpoint (FR-064), with sortable column headers that state
// their order (`aria-sort`).
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { ApiKey } from '@/api'
import { lt, text } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { ChevronDownIcon } from '@/shared/icons'

import type { ApiKeySort } from '../list-state'
import ApiKeyStatusBadge from './ApiKeyStatusBadge.vue'
import LastUse from './LastUse.vue'
import OwnerSummary from './OwnerSummary.vue'

const props = defineProps<{ keys: ApiKey[]; sort: ApiKeySort; order: SortOrder }>()
const emit = defineEmits<{ sort: [sort: ApiKeySort] }>()
const { t } = useI18n()

const ariaSort = (column: ApiKeySort) =>
  props.sort === column ? (props.order === 'asc' ? 'ascending' : 'descending') : 'none'

const cell = 'px-3 py-3 align-top text-sm text-gray-800 dark:text-gray-200'
const head = 'px-3 py-2 text-start text-sm font-medium text-gray-700 dark:text-gray-300'
</script>

<template>
  <div
    class="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
  >
    <table class="w-full border-collapse">
      <caption class="sr-only">
        {{
          t('apiKeys.title')
        }}
      </caption>
      <thead class="border-b border-gray-200 dark:border-gray-800">
        <tr>
          <template
            v-for="column in [
              { key: 'name', sortable: true },
              { key: 'prefix', sortable: false },
              { key: 'owner', sortable: false },
              { key: 'access', sortable: false },
              { key: 'status', sortable: false },
              { key: 'createdAt', sortable: true },
              { key: 'expiresAt', sortable: true },
              { key: 'lastUsedAt', sortable: true },
            ] as const"
            :key="column.key"
          >
            <th v-if="column.sortable" scope="col" :class="head" :aria-sort="ariaSort(column.key)">
              <button
                type="button"
                class="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 font-medium hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:text-white"
                @click="emit('sort', column.key)"
              >
                {{ text(`apiKeys.columns.${column.key}`) }}
                <ChevronDownIcon
                  class="size-4"
                  :class="[
                    sort === column.key ? '' : 'opacity-0',
                    sort === column.key && order === 'asc' ? 'rotate-180' : '',
                  ]"
                />
              </button>
            </th>
            <th v-else scope="col" :class="head">{{ text(`apiKeys.columns.${column.key}`) }}</th>
          </template>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr v-for="apiKey in keys" :key="apiKey.id">
          <td :class="cell" class="max-w-[16rem] font-medium wrap-anywhere">
            <RouterLink
              :to="{ name: 'api-key-detail', params: { apiKeyId: apiKey.id } }"
              class="text-link"
              >{{ apiKey.name }}</RouterLink
            >
          </td>
          <td :class="cell" class="font-mono">{{ apiKey.prefix }}</td>
          <td :class="cell" class="max-w-[14rem]"><OwnerSummary :owner="apiKey.owner" /></td>
          <td :class="cell">{{ text(`enums.apiKeyAccessLevel.${apiKey.accessLevel}`) }}</td>
          <td :class="cell"><ApiKeyStatusBadge :status="apiKey.status" /></td>
          <td :class="cell"><DateTime :value="apiKey.createdAt" /></td>
          <td :class="cell">
            <DateTime v-if="apiKey.expiresAt" :value="apiKey.expiresAt" />
            <template v-else>{{ lt('user.expire_never') }}</template>
          </td>
          <td :class="cell"><LastUse :api-key="apiKey" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

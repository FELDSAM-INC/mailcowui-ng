<script setup lang="ts">
// The OAuth2 clients as a table from md up (FR-055), with the classic list's columns ID, Client
// ID, Redirect URI and Action (`admin.js` draw_oauth2_clients; no secret column, owner decision).
// The first three sort from their headers with `aria-sort`. Slots: `select-all`, `select`,
// `actions`.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt, resolveText } from '@/i18n'
import type { Oauth2Client } from '@/api'
import type { SortOrder } from '@/shared/composables/useListState'

import { SORT_LABELS } from '../columns'
import type { Oauth2ClientSort } from '../list-state'
import RedirectUriList from './RedirectUriList.vue'

const props = withDefaults(
  defineProps<{
    clients: readonly Oauth2Client[]
    sort: Oauth2ClientSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: Oauth2ClientSort, order: SortOrder] }>()
const { t } = useI18n()

const COLUMNS: Oauth2ClientSort[] = ['id', 'clientId', 'redirectUri']

function ariaSort(key: Oauth2ClientSort) {
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(key: Oauth2ClientSort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
    <table class="w-full table-fixed text-sm">
      <caption class="sr-only">
        {{
          lt('admin.oauth2_apps')
        }}
      </caption>
      <thead
        class="border-b border-gray-200 text-start text-gray-600 dark:border-gray-800 dark:text-gray-400"
      >
        <tr>
          <th v-if="selectable" scope="col" class="w-16 px-3 py-2"><slot name="select-all" /></th>
          <th
            v-for="column in COLUMNS"
            :key="column"
            scope="col"
            class="px-3 py-2 text-start font-medium"
            :class="column === 'id' ? 'w-20' : column === 'clientId' ? 'w-44' : ''"
            :aria-sort="ariaSort(column)"
          >
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-1 font-medium hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column)"
            >
              {{ resolveText(SORT_LABELS[column], t) }}
              <span aria-hidden="true">{{
                sort === column ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
          </th>
          <th scope="col" class="w-56 px-3 py-2 text-end font-medium">{{ lt('admin.action') }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr v-for="client in clients" :key="client.id" :data-entry="client.id" class="align-top">
          <td v-if="selectable" class="px-3 py-3"><slot name="select" :client="client" /></td>
          <td class="px-3 py-3 text-gray-900 dark:text-white">{{ client.id }}</td>
          <td class="px-3 py-3">
            <RouterLink
              :to="{ name: 'oauth2-client-detail', params: { oauth2ClientId: client.id } }"
              class="inline-flex min-h-11 items-center font-mono break-all text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
            >
              {{ client.clientId }}
            </RouterLink>
          </td>
          <td class="min-w-0 px-3 py-3 text-gray-900 dark:text-white">
            <RedirectUriList :uris="client.redirectUris" />
          </td>
          <td class="px-3 py-3"><slot name="actions" :client="client" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

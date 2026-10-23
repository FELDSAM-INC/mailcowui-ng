<script setup lang="ts">
import DataRow from '@/shared/components/DataRow.vue'

import DataIdentity from '@/shared/components/DataIdentity.vue'

import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

// The keys as a table, from the md breakpoint (FR-064), with sortable column headers that state
// their order (`aria-sort`).
import { useI18n } from 'vue-i18n'

import type { ApiKey } from '@/api'
import { lt, text } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import RowControls from '@/shared/components/RowControls.vue'
import RowAction from '@/shared/components/RowAction.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import type { ApiKeySort } from '../list-state'
import ApiKeyStatusBadge from './ApiKeyStatusBadge.vue'
import LastUse from './LastUse.vue'
import OwnerSummary from './OwnerSummary.vue'

const props = defineProps<{
  hidden?: boolean
  keys: ApiKey[]
  sort: ApiKeySort
  order: SortOrder
}>()
const emit = defineEmits<{ sort: [sort: ApiKeySort] }>()
const { t } = useI18n()

const cell = 'px-3 py-3 align-top text-sm text-gray-800 dark:text-gray-200'

const tableView = useDataColumns(
  () =>
    ['name', 'prefix', 'owner', 'access', 'createdAt', 'expiresAt', 'lastUsedAt'].map((id) => ({
      id,
      label: text(`apiKeys.columns.${id}`),
      sort: ['name', 'createdAt', 'expiresAt', 'lastUsedAt'].includes(id) ? id : undefined,
    })),
  () => ({ key: props.sort, order: props.order, change: (key) => emit('sort', key as ApiKeySort) }),
)
</script>

<template>
  <div v-if="!hidden" class="table-frame">
    <table class="data-table w-full border-collapse">
      <caption class="sr-only">
        {{
          t('apiKeys.title')
        }}
      </caption>
      <thead class="border-b border-gray-200 dark:border-gray-800">
        <tr>
          <DataTableHeader
            v-for="column in tableView.columns.value"
            :key="column.id"
            :column="column.id"
          />
          <th scope="col" class="table-controls-cell px-3 py-2 text-end text-sm">
            {{ lt('mailbox.action') }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <DataRow
          v-for="apiKey in keys"
          :key="apiKey.id"
          :to="{ name: 'api-key-detail', params: { apiKeyId: apiKey.id } }"
          :label="apiKey.name"
        >
          <td
            v-show="tableView.visible('name')"
            :data-column="'name'"
            :class="cell"
            class="max-w-[16rem] font-medium wrap-anywhere"
          >
            <DataIdentity
              ><span class="font-medium wrap-anywhere">{{ apiKey.name }}</span
              ><template #badges><ApiKeyStatusBadge :status="apiKey.status" /></template
            ></DataIdentity>
          </td>
          <td
            v-show="tableView.visible('prefix')"
            :data-column="'prefix'"
            :class="cell"
            class="font-mono"
          >
            {{ apiKey.prefix }}
          </td>
          <td
            v-show="tableView.visible('owner')"
            :data-column="'owner'"
            :class="cell"
            class="max-w-[14rem]"
          >
            <OwnerSummary :owner="apiKey.owner" />
          </td>
          <td v-show="tableView.visible('access')" :data-column="'access'" :class="cell">
            {{ text(`enums.apiKeyAccessLevel.${apiKey.accessLevel}`) }}
          </td>

          <td v-show="tableView.visible('createdAt')" :data-column="'createdAt'" :class="cell">
            <DateTime :value="apiKey.createdAt" />
          </td>
          <td v-show="tableView.visible('expiresAt')" :data-column="'expiresAt'" :class="cell">
            <DateTime v-if="apiKey.expiresAt" :value="apiKey.expiresAt" />
            <template v-else>{{ lt('user.expire_never') }}</template>
          </td>
          <td v-show="tableView.visible('lastUsedAt')" :data-column="'lastUsedAt'" :class="cell">
            <LastUse :api-key="apiKey" />
          </td>
          <td :class="cell" class="table-controls-cell">
            <RowControls>
              <RowAction
                :menu="false"
                :label="lt('mailbox.edit')"
                :to="{ name: 'api-key-detail', params: { apiKeyId: apiKey.id } }"
                :aria-label="`${lt('mailbox.edit')}: ${apiKey.name}`"
              />
            </RowControls>
          </td>
        </DataRow>
      </tbody>
    </table>
  </div>
</template>

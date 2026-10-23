<script setup lang="ts">
import DataRow from '@/shared/components/DataRow.vue'

import DataIdentity from '@/shared/components/DataIdentity.vue'
import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import ActiveBadge from '@/shared/components/ActiveBadge.vue'

import { useI18n } from 'vue-i18n'
import type { RspamdSettingsRule } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PlainText from '@/shared/components/PlainText.vue'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'
import RowControls from '@/shared/components/RowControls.vue'
import type { RuleSort } from '../../rule-list-state'
defineProps<{
  hidden?: boolean
  items: RspamdSettingsRule[]
  sort?: RuleSort
  order?: 'asc' | 'desc'
  busy: boolean
}>()
defineEmits<{ sort: [value: RuleSort]; remove: [item: RspamdSettingsRule] }>()
const { t } = useI18n(),
  format = useFormat()
const columns = ['id', 'description', 'createdAt', 'modifiedAt'] as const
const label = (value: RuleSort) =>
  value === 'id'
    ? t('lists.id')
    : lt(
        value === 'description'
          ? 'admin.rsetting_desc'
          : value === 'active'
            ? 'admin.active'
            : value === 'createdAt'
              ? 'mailbox.created_on'
              : 'mailbox.last_modified',
      )

const tableView = useDataColumns(() => columns.map((id) => ({ id, label: label(id), sort: id })))
</script>
<template>
  <div v-if="!hidden" class="table-frame">
    <table
      class="data-table w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
      data-rule-list
    >
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-800">
          <DataTableHeader v-for="column in columns" :key="column" :column="column" />
          <th class="table-controls-cell p-2 text-end">{{ lt('mailbox.action') }}</th>
        </tr>
      </thead>
      <tbody>
        <DataRow
          v-for="item in items"
          :key="item.id"
          :to="{ name: 'rspamd-rule-detail', params: { ruleId: item.id } }"
          :label="item.description"
          :data-rule-id="item.id"
          class="border-b border-gray-200 align-top dark:border-gray-800"
        >
          <td v-show="tableView.visible('id')" :data-column="'id'" class="p-2">
            <DataIdentity
              >{{ item.id }}<template #badges><ActiveBadge :active="item.active" /></template
            ></DataIdentity>
          </td>
          <td
            v-show="tableView.visible('description')"
            :data-column="'description'"
            class="p-2 wrap-anywhere"
          >
            <PlainText :value="item.description" />
          </td>

          <td v-show="tableView.visible('createdAt')" :data-column="'createdAt'" class="p-2">
            {{ format.dateTime(item.createdAt) }}
          </td>
          <td v-show="tableView.visible('modifiedAt')" :data-column="'modifiedAt'" class="p-2">
            {{ item.modifiedAt ? format.dateTime(item.modifiedAt) : '—' }}
          </td>
          <td class="table-controls-cell p-2">
            <RowControls>
              <RowActions
                v-slot="{ menu }"
                :count="2"
                :label="`${lt('mailbox.action')}: ${item.description}`"
              >
                <RowAction
                  :menu="menu"
                  :to="{ name: 'rspamd-rule-detail', params: { ruleId: item.id } }"
                  :label="lt('mailbox.edit')"
                  :aria-label="`${lt('mailbox.edit')}: ${item.description}`"
                />
                <RowAction
                  :menu="menu"
                  :disabled="busy"
                  destructive
                  :label="lt('mailbox.remove')"
                  :aria-label="`${lt('mailbox.remove')}: ${item.description}`"
                  @select="$emit('remove', item)"
                />
              </RowActions>
            </RowControls>
          </td>
        </DataRow>
      </tbody>
    </table>
  </div>
</template>

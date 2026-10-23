<script setup lang="ts">
import DataIdentity from '@/shared/components/DataIdentity.vue'
import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import ActiveBadge from '@/shared/components/ActiveBadge.vue'

import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import type { SieveFilter } from '@/api'
import { lt } from '@/i18n'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'
import RowControls from '@/shared/components/RowControls.vue'
import ScriptBlock from './ScriptBlock.vue'
defineProps<{
  hidden?: boolean
  items: SieveFilter[]
  location: (item: SieveFilter) => RouteLocationRaw
  selecting: boolean
  selected: (id: string) => boolean
  canSelect: (id: string) => boolean
  canChange: boolean
  busy: boolean
}>()
defineEmits<{ toggle: [id: string]; remove: [item: SieveFilter] }>()
const { t } = useI18n()
const id = useId()
const expanded = ref(new Set<number>())
function toggleDetails(filterId: number) {
  if (expanded.value.has(filterId)) expanded.value.delete(filterId)
  else expanded.value.add(filterId)
}

const tableView = useDataColumns(() => [
  { id: 'id', label: t('lists.id'), sort: 'id' },
  { id: 'mailbox', label: lt('mailbox.owner'), sort: 'mailbox' },
  { id: 'description', label: lt('mailbox.description'), sort: 'description' },
  { id: 'kind', label: t('filters.columns.type'), sort: 'kind' },
])
</script>
<template>
  <div v-if="!hidden" class="table-frame">
    <table
      class="data-table w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
      :style="!canChange ? { '--table-controls-width': '9rem' } : undefined"
      data-filter-list
    >
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-800">
          <th v-if="selecting" class="w-14 p-2">
            <span class="sr-only">{{ lt('mailbox.toggle_all') }}</span>
          </th>
          <DataTableHeader column="id" />
          <DataTableHeader column="mailbox" />
          <DataTableHeader column="description" />
          <DataTableHeader column="kind" />

          <th class="table-controls-cell p-2 text-end">{{ lt('mailbox.action') }}</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="item in items" :key="item.id">
          <tr
            :data-filter-id="item.id"
            class="border-b border-gray-200 align-top dark:border-gray-800"
          >
            <td v-if="selecting" class="p-2">
              <label class="flex size-11 items-center justify-center"
                ><span class="sr-only">{{ item.description }}</span
                ><input
                  type="checkbox"
                  class="size-5"
                  :checked="selected(String(item.id))"
                  :disabled="busy || !canSelect(String(item.id))"
                  @change="$emit('toggle', String(item.id))"
              /></label>
            </td>
            <td v-show="tableView.visible('id')" :data-column="'id'" class="p-2">
              <DataIdentity
                >{{ item.id }}<template #badges><ActiveBadge :active="item.active" /></template
              ></DataIdentity>
            </td>
            <td
              v-show="tableView.visible('mailbox')"
              :data-column="'mailbox'"
              class="p-2 wrap-anywhere"
            >
              {{ item.mailbox }}
            </td>
            <td
              v-show="tableView.visible('description')"
              :data-column="'description'"
              class="p-2 wrap-anywhere"
            >
              <p>{{ item.description }}</p>
            </td>
            <td v-show="tableView.visible('kind')" :data-column="'kind'" class="p-2">
              {{ t(`filters.kind.${item.kind}`) }}
            </td>

            <td class="table-controls-cell p-2">
              <RowControls
                :expanded="expanded.has(item.id)"
                :controls="`${id}-script-${item.id}`"
                :label="`${t('filters.columns.script')}: ${item.description}`"
                @toggle="toggleDetails(item.id)"
              >
                <RowActions
                  v-slot="{ menu }"
                  :count="canChange ? 2 : 1"
                  :label="`${lt('mailbox.action')}: ${item.description}`"
                >
                  <RowAction
                    :menu="menu"
                    :to="location(item)"
                    :label="lt('mailbox.edit')"
                    :aria-label="`${lt('mailbox.edit')}: ${item.description}`"
                  />
                  <RowAction
                    v-if="canChange"
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
          </tr>
          <tr v-if="expanded.has(item.id)" :id="`${id}-script-${item.id}`">
            <td :colspan="tableView.visibleCount.value + (selecting ? 2 : 1)" class="p-3">
              <ScriptBlock :script="item.script" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { SieveFilter } from '@/api'
import { lt } from '@/i18n'
import { buttonVariants } from '@/shared/ui/button'
import ScriptBlock from './ScriptBlock.vue'
defineProps<{
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
</script>
<template>
  <div class="table-frame">
    <table
      class="data-table w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
      data-filter-list
    >
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-800">
          <th v-if="selecting" class="w-14 p-2">
            <span class="sr-only">{{ lt('mailbox.toggle_all') }}</span>
          </th>
          <th class="w-16 p-2 text-start">{{ t('lists.id') }}</th>
          <th class="p-2 text-start">{{ lt('mailbox.owner') }}</th>
          <th class="p-2 text-start">{{ lt('mailbox.description') }}</th>
          <th class="w-24 p-2 text-start">{{ t('filters.columns.type') }}</th>
          <th class="w-24 p-2 text-start">{{ lt('mailbox.active') }}</th>
          <th class="w-44 p-2 text-start">{{ lt('mailbox.action') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
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
          <td class="p-2">{{ item.id }}</td>
          <td class="p-2 wrap-anywhere">{{ item.mailbox }}</td>
          <td class="p-2 wrap-anywhere">
            <p>{{ item.description }}</p>
            <details class="min-w-0">
              <summary class="min-h-11 cursor-pointer content-center">
                {{ t('filters.columns.script') }}
              </summary>
              <ScriptBlock :script="item.script" />
            </details>
          </td>
          <td class="p-2">{{ t(`filters.kind.${item.kind}`) }}</td>
          <td class="p-2">{{ lt(item.active ? 'mailbox.active' : 'mailbox.inactive') }}</td>
          <td class="p-2">
            <div class="table-actions flex flex-wrap gap-1">
              <RouterLink
                :to="location(item)"
                :aria-label="`${lt('mailbox.edit')}: ${item.description}`"
                :class="buttonVariants({ variant: 'outline' })"
                >{{ lt('mailbox.edit') }}</RouterLink
              >
              <button
                v-if="canChange"
                type="button"
                :disabled="busy"
                :aria-label="`${lt('mailbox.remove')}: ${item.description}`"
                :class="buttonVariants({ variant: 'outline' })"
                @click="$emit('remove', item)"
              >
                {{ lt('mailbox.remove') }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { RspamdSettingsRule } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PlainText from '@/shared/components/PlainText.vue'
import { buttonVariants } from '@/shared/ui/button'
import type { RuleSort } from '../../rule-list-state'
defineProps<{
  items: RspamdSettingsRule[]
  sort?: RuleSort
  order?: 'asc' | 'desc'
  busy: boolean
}>()
defineEmits<{ sort: [value: RuleSort]; remove: [item: RspamdSettingsRule] }>()
const { t } = useI18n(),
  format = useFormat()
const columns = ['id', 'description', 'active', 'createdAt', 'modifiedAt'] as const
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
</script>
<template>
  <table
    class="w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
    data-rule-list
  >
    <thead>
      <tr class="border-b border-gray-200 dark:border-gray-800">
        <th
          v-for="column in columns"
          :key="column"
          :aria-sort="sort === column ? (order === 'desc' ? 'descending' : 'ascending') : undefined"
          class="p-2 text-start"
          :class="column === 'id' ? 'w-16' : column === 'active' ? 'w-24' : ''"
        >
          <button
            type="button"
            class="min-h-11 min-w-11 text-start font-semibold"
            @click="$emit('sort', column)"
          >
            {{ label(column) }}
          </button>
        </th>
        <th class="w-32 p-2 text-start">{{ lt('mailbox.action') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="item in items"
        :key="item.id"
        :data-rule-id="item.id"
        class="border-b border-gray-200 align-top dark:border-gray-800"
      >
        <td class="p-2">{{ item.id }}</td>
        <td class="p-2 wrap-anywhere"><PlainText :value="item.description" /></td>
        <td class="p-2">{{ lt(item.active ? 'mailbox.active' : 'mailbox.inactive') }}</td>
        <td class="p-2">{{ format.dateTime(item.createdAt) }}</td>
        <td class="p-2">{{ item.modifiedAt ? format.dateTime(item.modifiedAt) : '—' }}</td>
        <td class="p-2">
          <div class="flex flex-wrap gap-2">
            <RouterLink
              :to="{ name: 'rspamd-rule-detail', params: { ruleId: item.id } }"
              :aria-label="`${lt('mailbox.edit')}: ${item.description}`"
              :class="buttonVariants({ variant: 'outline' })"
              >{{ lt('mailbox.edit') }}</RouterLink
            ><button
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
</template>

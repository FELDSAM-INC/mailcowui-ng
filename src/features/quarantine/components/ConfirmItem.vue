<script setup lang="ts">
// The item named in a single action's confirmation (UI 006 legacy form map screen 2): legacy's
// `footer.delete_these_items` (or the action's own text) before the item's ID, subject and sender,
// as `#ConfirmDeleteModal` and the `qhandler` page show them. Message data goes through PlainText.
import { useI18n } from 'vue-i18n'

import type { QuarantineItem } from '@/api'
import { lt } from '@/i18n'
import PlainText from '@/shared/components/PlainText.vue'

defineProps<{ item: Pick<QuarantineItem, 'id' | 'subject' | 'sender'>; intro?: string }>()
const { t } = useI18n()
</script>

<template>
  <div data-confirm-item class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p v-if="intro">{{ intro }}</p>
    <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
      <dt class="font-medium text-gray-800 dark:text-gray-200">{{ t('lists.id') }}</dt>
      <dd class="tabular-nums">{{ item.id }}</dd>
      <dt class="font-medium text-gray-800 dark:text-gray-200">{{ lt('quarantine.subj') }}</dt>
      <dd><PlainText :value="item.subject || '-'" /></dd>
      <dt class="font-medium text-gray-800 dark:text-gray-200">{{ lt('quarantine.sender') }}</dt>
      <dd><PlainText :value="item.sender || '-'" /></dd>
    </dl>
  </div>
</template>

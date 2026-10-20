<script setup lang="ts">
// The body of the notification mass action's confirmation (legacy form map screen 4): the chosen
// option's legacy label, legacy-free `bulk.selected` with the count, then the selected mailboxes.
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

defineProps<{ value: string; addresses: readonly string[] }>()
const { t } = useI18n()
</script>

<template>
  <div data-bulk-confirm class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p data-bulk-value class="font-medium text-gray-900 dark:text-white">{{ value }}</p>
    <p>{{ t('bulk.selected', { count: addresses.length }) }}</p>
    <!-- A long list scrolls; the region takes the focus, so the keyboard can scroll it. -->
    <div
      role="region"
      tabindex="0"
      :aria-label="lt('mailbox.mailboxes')"
      class="max-h-60 overflow-y-auto rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <ul class="flex list-disc flex-col gap-0.5 ps-5">
        <li
          v-for="address in addresses"
          :key="address"
          class="text-gray-700 wrap-anywhere dark:text-gray-300"
        >
          {{ address }}
        </li>
      </ul>
    </div>
  </div>
</template>

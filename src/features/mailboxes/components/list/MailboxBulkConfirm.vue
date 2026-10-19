<script setup lang="ts">
// The body of a mass action's confirmation (FR-055): legacy's `footer.delete_these_items` for a
// deletion, or the action's effect, then the selected mailboxes.
import { lt } from '@/i18n'

defineProps<{ addresses: readonly string[]; effect?: string }>()
</script>

<template>
  <div data-bulk-confirm class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p>{{ effect ?? lt('footer.delete_these_items') }}</p>
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
          class="wrap-anywhere text-gray-700 dark:text-gray-300"
        >
          {{ address }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
// The entries a removal affects, inside legacy's `#ConfirmDeleteModal` texts (legacy form map
// screen 5): each entry's ID and pattern, scrollable from the keyboard when the list is long.
import type { SpamPolicyEntry } from '@/api'
import PlainText from '@/shared/components/PlainText.vue'

defineProps<{ entries: readonly SpamPolicyEntry[] }>()
</script>

<template>
  <ul
    data-remove-entries
    tabindex="0"
    class="flex max-h-60 list-disc flex-col gap-0.5 overflow-y-auto ps-5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
  >
    <li v-for="entry in entries" :key="entry.id" class="break-all">
      <span class="tabular-nums">{{ entry.id }}</span> · <PlainText :value="entry.pattern" />
    </li>
  </ul>
</template>

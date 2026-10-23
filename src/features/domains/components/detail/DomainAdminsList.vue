<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// The domain administrators of a domain, for administrators only (FR-015). The list is the action
// area where UI 007 links each username to its detail (data-model §9).
import { lt } from '@/i18n'

defineProps<{ admins: readonly string[] }>()
</script>

<template>
  <section
    data-domain-admins
    aria-labelledby="domain-admins-title"
    class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="domain-admins-title" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ lt('mailbox.domain_admins') }}
    </h2>
    <ul v-if="admins.length > 0" class="mt-3 flex flex-wrap gap-2">
      <li v-for="admin in admins" :key="admin" class="max-w-full min-w-0">
        <Badge color="gray">{{ admin }}</Badge>
      </li>
    </ul>
    <p v-else class="mt-3 text-sm text-gray-700 dark:text-gray-300">
      {{ lt('mailbox.no_record_single') }}
    </p>
  </section>
</template>

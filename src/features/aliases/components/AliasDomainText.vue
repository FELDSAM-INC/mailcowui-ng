<script setup lang="ts">
// The domain of an alias (FR-012): its own domain, and for an alias in an alias domain its primary
// domain as text with legacy's label (`mailbox.target_domain`, the classic table's tooltip).
import type { Alias } from '@/api'
import { lt } from '@/i18n'

defineProps<{ alias: Alias }>()
</script>

<template>
  <span class="flex min-w-0 flex-col">
    <span class="break-all">{{ alias.domainUnicode }}</span>
    <span v-if="alias.inAliasDomain" class="text-sm break-all text-gray-600 dark:text-gray-400">
      {{ lt('mailbox.target_domain') }}: {{ alias.primaryDomainUnicode }}
    </span>
  </span>
</template>

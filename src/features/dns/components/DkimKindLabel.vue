<script setup lang="ts">
// The kind of a DKIM entry (FR-006): "Domain", "Alias domain" with its target below (as legacy's
// "↳" rows), or "No domain" for an unused key.
import type { DkimKey } from '@/api'
import { text } from '@/i18n'

defineProps<{ entry: DkimKey }>()
</script>

<template>
  <span class="flex min-w-0 flex-col">
    <span>{{ text(`dns.dkim.kinds.${entry.kind}`) }}</span>
    <span
      v-if="entry.kind === 'aliasDomain' && entry.targetDomain"
      class="text-sm break-all text-gray-600 dark:text-gray-400"
      >↳ {{ entry.targetDomain }}</span
    >
  </span>
</template>

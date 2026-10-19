<script setup lang="ts">
// One group of diagnostics checks: cards below md and a table from md up (FR-068).
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { DnsCheck } from '@/api'

import DnsCheckCard from './DnsCheckCard.vue'
import DnsCheckTable from './DnsCheckTable.vue'

defineProps<{ checks: readonly DnsCheck[]; title: string }>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <DnsCheckTable v-if="wide" :checks="checks" :caption="title" />
  <ul v-else :aria-label="title" class="flex flex-col gap-3">
    <DnsCheckCard v-for="check in checks" :key="check.id" :check="check" />
  </ul>
</template>

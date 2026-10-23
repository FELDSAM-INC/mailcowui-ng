<script setup lang="ts">
import { useLocalDataList } from '@/shared/composables/useLocalDataList'
import ListToolbar from '@/shared/components/ListToolbar.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useId } from 'vue'
import { lt } from '@/i18n'
import { dnsCheckColumns } from '../diagnostics/check-columns'

// One group of diagnostics checks: cards below md and a table from md up (FR-068).
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { DnsCheck } from '@/api'

import DnsCheckCard from './DnsCheckCard.vue'
import DnsCheckTable from './DnsCheckTable.vue'

const props = defineProps<{ checks: readonly DnsCheck[]; title: string }>()
const searchId = useId()
const wide = useMediaQuery('(min-width: 768px)')

const listing = useLocalDataList('dns-checks', () => props.checks, dnsCheckColumns)
</script>

<template>
  <ListToolbar class="mb-3"
    ><template #search
      ><SearchField
        :id="searchId"
        :label="lt('datatables.search')"
        :model-value="listing.search.value"
        @search="listing.search.value = $event" /></template
  ></ListToolbar>

  <DnsCheckTable v-if="wide" :checks="listing.rows.value" :caption="title" />
  <ul v-else :aria-label="title" class="flex flex-col gap-3">
    <DnsCheckCard v-for="check in listing.rows.value" :key="check.id" :check="check" />
  </ul>
</template>

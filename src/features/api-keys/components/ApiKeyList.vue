<script setup lang="ts">
// The keys of one page: cards below the md breakpoint, a table from md up (conventions "Lists").
import type { ApiKey } from '@/api'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { ApiKeySort } from '../list-state'
import ApiKeyCard from './ApiKeyCard.vue'
import ApiKeyTable from './ApiKeyTable.vue'

defineProps<{ keys: ApiKey[]; sort: ApiKeySort; order: SortOrder }>()
defineEmits<{ sort: [sort: ApiKeySort] }>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <ApiKeyTable v-if="wide" :keys="keys" :sort="sort" :order="order" @sort="$emit('sort', $event)" />
  <ul v-else class="flex flex-col gap-3">
    <li v-for="apiKey in keys" :key="apiKey.id"><ApiKeyCard :api-key="apiKey" /></li>
  </ul>
</template>

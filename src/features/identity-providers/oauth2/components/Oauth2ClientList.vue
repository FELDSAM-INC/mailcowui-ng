<script setup lang="ts">
// The OAuth2 clients of one page: cards below md and a table from md up (FR-055). The selection
// and entry action slots pass through to both layouts.
import { lt } from '@/i18n'
import type { Oauth2Client } from '@/api'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { Oauth2ClientSort } from '../list-state'
import Oauth2ClientCard from './Oauth2ClientCard.vue'
import Oauth2ClientTable from './Oauth2ClientTable.vue'

withDefaults(
  defineProps<{
    clients: readonly Oauth2Client[]
    sort: Oauth2ClientSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: Oauth2ClientSort, order: SortOrder] }>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <Oauth2ClientTable
    v-if="wide"
    :clients="clients"
    :sort="sort"
    :order="order"
    :selectable="selectable"
    @sort="(key, value) => emit('sort', key, value)"
  >
    <template #select-all><slot name="select-all" /></template>
    <template #select="{ client }"><slot name="select" :client="client" /></template>
    <template #actions="{ client }"><slot name="actions" :client="client" /></template>
  </Oauth2ClientTable>
  <ul v-else :aria-label="lt('admin.oauth2_apps')" class="flex flex-col gap-3">
    <Oauth2ClientCard v-for="client in clients" :key="client.id" :client="client">
      <template v-if="selectable" #select><slot name="select" :client="client" /></template>
      <template #actions><slot name="actions" :client="client" /></template>
    </Oauth2ClientCard>
  </ul>
</template>

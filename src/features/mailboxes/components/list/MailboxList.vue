<script setup lang="ts">
// The mailboxes of one page: cards below md and a table from md up (UI 001 R21). The selection
// and action slots pass through to both layouts.
import { lt } from '@/i18n'
import type { SortOrder } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import type { ColumnSpec } from '../../columns'
import type { MailboxSort } from '../../labels'
import type { Mailbox } from '../../types'
import MailboxCard from './MailboxCard.vue'
import MailboxTable from './MailboxTable.vue'

withDefaults(
  defineProps<{
    mailboxes: readonly Mailbox[]
    columns: readonly ColumnSpec[]
    sort: MailboxSort
    order: SortOrder
    selectable?: boolean
  }>(),
  { selectable: false },
)
const emit = defineEmits<{ sort: [sort: MailboxSort, order: SortOrder] }>()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <MailboxTable
    :hidden="!wide"
    :mailboxes="mailboxes"
    :columns="columns"
    :sort="sort"
    :order="order"
    :selectable="selectable"
    @sort="(sort, order) => emit('sort', sort, order)"
  >
    <template #select-all><slot name="select-all" /></template>
    <template #select="{ mailbox }"><slot name="select" :mailbox="mailbox" /></template>
    <template #actions="{ mailbox }"><slot name="actions" :mailbox="mailbox" /></template>
  </MailboxTable>
  <ul v-if="!wide" :aria-label="lt('mailbox.mailboxes')" class="flex flex-col gap-3">
    <MailboxCard v-for="mailbox in mailboxes" :key="mailbox.address" :mailbox="mailbox">
      <template v-if="selectable" #select><slot name="select" :mailbox="mailbox" /></template>
      <template #actions><slot name="actions" :mailbox="mailbox" /></template>
    </MailboxCard>
  </ul>
</template>

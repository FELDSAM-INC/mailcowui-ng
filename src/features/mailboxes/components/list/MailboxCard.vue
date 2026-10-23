<script setup lang="ts">
// The same compact mobile row as domains and aliases. Secondary columns remain available
// in its bottom disclosure, including protocol flags and full per-protocol login times.
import { lt } from '@/i18n'
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import { COLUMNS } from '../../columns'
import { readableAddress, type Mailbox } from '../../types'
import MailboxStatusBadge from '../display/MailboxStatusBadge.vue'
import MailboxCell from './MailboxCell.vue'

defineProps<{ mailbox: Mailbox }>()
const primary = COLUMNS.filter((column) => ['quota', 'inUse', 'messages'].includes(column.id))
const details = COLUMNS.filter(
  (column) =>
    !['address', 'quota', 'inUse', 'messages', 'status', 'displayName'].includes(column.id),
)
</script>

<template>
  <DataCard
    :data-entry="mailbox.address"
    :title="readableAddress(mailbox)"
    :to="{ name: 'mailbox-detail', params: { address: mailbox.address } }"
  >
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <template v-if="mailbox.displayName" #subtitle>
      <span data-display-name>{{ mailbox.displayName }}</span>
    </template>
    <template #badges><MailboxStatusBadge :status="mailbox.status" /></template>
    <DataCardFields>
      <div v-for="column in primary" :key="column.id" :data-column="column.id">
        <dt>{{ column.label ? lt(column.label) : column.text }}</dt>
        <dd><MailboxCell :mailbox="mailbox" :column="column.id" /></dd>
      </div>
    </DataCardFields>
    <template #details>
      <DataCardFields :data-entry-details="mailbox.address">
        <div
          v-for="column in details"
          :key="column.id"
          :data-column="column.id"
          :data-wide="column.id === 'lastMailLogin' || column.id === 'tags' ? '' : undefined"
        >
          <dt>{{ column.label ? lt(column.label) : column.text }}</dt>
          <dd><MailboxCell :mailbox="mailbox" :column="column.id" /></dd>
        </div>
      </DataCardFields>
    </template>
  </DataCard>
</template>

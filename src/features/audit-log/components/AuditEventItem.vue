<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

// One audit record as a card (FR-072): time, event type, outcome in text, actor, client address,
// authentication method and, for failures, the reason; the rest expands.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AuditEvent } from '@/api'
import { lt } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'

import { useAuditLabels } from '../labels'
import AuditEventDetails from './AuditEventDetails.vue'
import AuditOutcome from './AuditOutcome.vue'

const props = defineProps<{ event: AuditEvent }>()
const { t } = useI18n()
const labels = useAuditLabels()
const titleId = useId()
const reason = computed(() =>
  props.event.failureReason ? labels.label('failureReason', props.event.failureReason) : null,
)
</script>

<template>
  <DataCard
    as="article"
    :title-id="titleId"
    :title="labels.label('eventType', event.eventType)"
    :details-label="t('auditLog.details.show')"
  >
    <template #badges><AuditOutcome :outcome="event.outcome" /></template>
    <DataCardFields>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.time') }}</dt>
      <dd class="min-w-0 text-gray-900 dark:text-white"><DateTime :value="event.occurredAt" /></dd>
      <dt class="text-gray-600 dark:text-gray-400">{{ t('auditLog.columns.actor') }}</dt>
      <dd class="min-w-0 wrap-anywhere text-gray-900 dark:text-white">{{ labels.actor(event) }}</dd>
      <dt class="text-gray-600 dark:text-gray-400">{{ t('auditLog.columns.address') }}</dt>
      <dd class="min-w-0 wrap-anywhere text-gray-900 dark:text-white">{{ event.clientAddress }}</dd>
      <dt class="text-gray-600 dark:text-gray-400">{{ t('auditLog.columns.method') }}</dt>
      <dd class="min-w-0 text-gray-900 dark:text-white">{{ labels.method(event) }}</dd>
      <template v-if="reason">
        <dt class="text-gray-600 dark:text-gray-400">{{ t('auditLog.columns.reason') }}</dt>
        <dd class="min-w-0 text-gray-900 dark:text-white">{{ reason }}</dd>
      </template>
    </DataCardFields>
    <template #details><AuditEventDetails :event="event" variant="list" /></template>
  </DataCard>
</template>

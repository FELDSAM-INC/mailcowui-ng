<script setup lang="ts">
// One audit record as a card (FR-072): time, event type, outcome in text, actor, client address,
// authentication method and, for failures, the reason; the rest expands.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AuditEvent } from '@/api'
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
  <article :aria-labelledby="titleId" class="surface flex flex-col gap-3">
    <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <h3 :id="titleId" class="font-semibold wrap-anywhere text-gray-900 dark:text-white">
        {{ labels.label('eventType', event.eventType) }}
      </h3>
      <AuditOutcome :outcome="event.outcome" />
    </div>
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt class="text-gray-600 dark:text-gray-400">{{ t('auditLog.columns.time') }}</dt>
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
    </dl>
    <AuditEventDetails :event="event" />
  </article>
</template>

<script setup lang="ts">
// The expandable part of an audit record (FR-072): the target, the user agent, the request ID and
// the other non-secret details, all rendered as text in a definition list. Cards use the
// collapsible variant (Reka Collapsible); the table renders the list in a row of its own.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AuditEvent } from '@/api'
import { ChevronDownIcon } from '@/shared/icons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'

import { useAuditLabels } from '../labels'

const props = withDefaults(defineProps<{ event: AuditEvent; variant?: 'collapsible' | 'list' }>(), {
  variant: 'collapsible',
})
const { t } = useI18n()
const { label } = useAuditLabels()
const open = ref(false)

const regionLabel = computed(() =>
  t('auditLog.details.label', { event: label('eventType', props.event.eventType) }),
)

const target = computed(() => {
  const value = props.event.target
  if (!value) return t('auditLog.details.none')
  const type = label('targetType', value.type)
  if (value.name && value.id) return `${type}: ${value.name} (${value.id})`
  if (value.name) return `${type}: ${value.name}`
  if (value.id) return `${type} (${value.id})`
  return type
})

function text(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => text(item)).join(', ')
  if (value !== null && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const rows = computed(() => [
  { key: 'target', term: t('auditLog.details.target'), value: target.value },
  {
    key: 'userAgent',
    term: t('auditLog.details.userAgent'),
    value: props.event.userAgent ?? t('auditLog.details.none'),
  },
  { key: 'requestId', term: t('auditLog.details.requestId'), value: props.event.requestId },
  ...Object.entries(props.event.details).map(([key, value]) => ({
    key: `detail-${key}`,
    term: key,
    value: text(value),
  })),
])
</script>

<template>
  <section v-if="variant === 'list'" :aria-label="regionLabel">
    <dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
      <template v-for="row in rows" :key="row.key">
        <dt class="font-medium text-gray-800 dark:text-gray-200">{{ row.term }}</dt>
        <dd class="min-w-0 wrap-anywhere text-gray-700 dark:text-gray-300">{{ row.value }}</dd>
      </template>
    </dl>
  </section>
  <Collapsible v-else v-model:open="open">
    <CollapsibleTrigger
      class="flex min-h-11 items-center gap-2 rounded-lg font-medium text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
    >
      {{ open ? t('auditLog.details.hide') : t('auditLog.details.show') }}
      <ChevronDownIcon
        class="size-4 shrink-0 motion-safe:transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </CollapsibleTrigger>
    <CollapsibleContent class="motion-reduce:animate-none">
      <!-- The component itself, in its list variant (self-reference by file name). -->
      <AuditEventDetails :event="event" variant="list" class="pt-2" />
    </CollapsibleContent>
  </Collapsible>
</template>

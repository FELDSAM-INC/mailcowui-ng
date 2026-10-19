<script setup lang="ts">
// The expandable part of an audit record (FR-072): the target, the user agent, the request ID and
// the other non-secret details, all rendered as text in a definition list. Cards use the
// collapsible variant (Reka Collapsible); the table renders the list in a row of its own. UI 004
// links the target back to its object and shows the documented detail keys as lines of text
// (`auditTargetLink`, `auditDetailRows`).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import type { AuditEvent } from '@/api'
import { ChevronDownIcon } from '@/shared/icons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'

import {
  auditDetailRows,
  auditTargetLink,
  COLLAPSED_LINES,
  useAuditLabels,
  type AuditLink,
} from '../labels'

const props = withDefaults(defineProps<{ event: AuditEvent; variant?: 'collapsible' | 'list' }>(), {
  variant: 'collapsible',
})
const { t } = useI18n()
const router = useRouter()
const { label, detail } = useAuditLabels()
/** Flags read Yes or No (UI 003). */
const flag = (value: boolean) => t(value ? 'domains.values.yes' : 'domains.values.no')
/** Only links to screens that exist (conventions "Where features meet"). */
const usable = (link: AuditLink | null | undefined) =>
  link && router?.hasRoute(link.name) ? link : undefined
const open = ref(false)
/** UI 011 (FR-075): the rows whose long list the user expanded. */
const expanded = ref(new Set<string>())
const shownLines = (row: { key: string; lines: string[] }) =>
  row.lines.length > COLLAPSED_LINES && !expanded.value.has(row.key)
    ? row.lines.slice(0, COLLAPSED_LINES)
    : row.lines
function expand(key: string) {
  expanded.value = new Set([...expanded.value, key])
}

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

interface Row {
  key: string
  term: string
  lines: string[]
  link?: AuditLink
}

const rows = computed<Row[]>(() => [
  {
    key: 'target',
    term: t('auditLog.details.target'),
    lines: [target.value],
    link: usable(auditTargetLink(props.event)),
  },
  {
    key: 'userAgent',
    term: t('auditLog.details.userAgent'),
    lines: [props.event.userAgent ?? t('auditLog.details.none')],
  },
  { key: 'requestId', term: t('auditLog.details.requestId'), lines: [props.event.requestId] },
  ...auditDetailRows(props.event, flag).map((row) => ({
    key: `detail-${row.key}`,
    term: detail(row.key),
    lines: row.lines,
    link: usable(row.link),
  })),
])
</script>

<template>
  <section v-if="variant === 'list'" :aria-label="regionLabel">
    <dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
      <template v-for="row in rows" :key="row.key">
        <dt class="font-medium text-gray-800 dark:text-gray-200">{{ row.term }}</dt>
        <dd class="min-w-0 wrap-anywhere text-gray-700 dark:text-gray-300">
          <RouterLink
            v-if="row.link"
            :to="row.link"
            class="text-brand-600 underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
            >{{ row.lines.join(' ') }}</RouterLink
          >
          <template v-else-if="row.lines.length === 1">{{ row.lines[0] }}</template>
          <template v-else>
            <span v-for="(line, at) in shownLines(row)" :key="at" class="block">{{ line }}</span>
            <button
              v-if="shownLines(row).length < row.lines.length"
              type="button"
              class="inline-flex min-h-11 items-center font-medium text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
              @click="expand(row.key)"
            >
              {{ t('auditLog.details.showAll', { count: row.lines.length }) }}
            </button>
          </template>
        </dd>
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

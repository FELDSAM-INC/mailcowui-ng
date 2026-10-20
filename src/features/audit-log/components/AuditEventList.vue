<script setup lang="ts">
// The audit records (FR-072, conventions "Lists"): cards below the md breakpoint, a table from md
// up. A table row expands into a row of its own with the details.
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AuditEvent } from '@/api'
import { legacy, resolveText, type TextRef } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { ChevronDownIcon } from '@/shared/icons'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/shared/ui/table'

import { useAuditLabels } from '../labels'
import AuditEventDetails from './AuditEventDetails.vue'
import AuditEventItem from './AuditEventItem.vue'
import AuditOutcome from './AuditOutcome.vue'

defineProps<{ events: AuditEvent[] }>()
const { t } = useI18n()
const labels = useAuditLabels()
const wide = useMediaQuery('(min-width: 768px)')
const expanded = reactive(new Set<string>())

function toggle(id: string) {
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
}

/** Column headers; the time column is the classic log tables' (`admin.time`). */
const COLUMNS: readonly { key: string; label: TextRef }[] = [
  { key: 'time', label: legacy('admin.time') },
  { key: 'event', label: 'auditLog.columns.event' },
  { key: 'outcome', label: 'auditLog.columns.outcome' },
  { key: 'actor', label: 'auditLog.columns.actor' },
  { key: 'address', label: 'auditLog.columns.address' },
  { key: 'method', label: 'auditLog.columns.method' },
  { key: 'reason', label: 'auditLog.columns.reason' },
]
const detailsId = (id: string) => `audit-details-${id}`
</script>

<template>
  <ul v-if="!wide" :aria-label="t('auditLog.records')" class="flex flex-col gap-3">
    <li v-for="event in events" :key="event.id">
      <AuditEventItem :event="event" />
    </li>
  </ul>
  <div v-else class="surface overflow-x-auto p-0! sm:p-0!">
    <Table class="text-start text-sm">
      <caption class="sr-only">
        {{
          t('auditLog.records')
        }}
      </caption>
      <TableHeader class="border-b border-gray-200 dark:border-gray-800">
        <TableRow>
          <TableCell
            v-for="column in COLUMNS"
            :key="column.key"
            is-header
            scope="col"
            class="px-4 py-3 text-start font-medium text-gray-700 dark:text-gray-300"
          >
            {{ resolveText(column.label, t) }}
          </TableCell>
          <TableCell is-header scope="col" class="px-4 py-3">
            <span class="sr-only">{{ t('auditLog.columns.details') }}</span>
          </TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="event in events" :key="event.id">
          <TableRow data-record class="border-b border-gray-100 align-top dark:border-gray-800">
            <TableCell class="px-4 py-3 text-gray-900 dark:text-white">
              <DateTime :value="event.occurredAt" />
            </TableCell>
            <TableCell class="px-4 py-3 font-medium wrap-anywhere text-gray-900 dark:text-white">
              {{ labels.label('eventType', event.eventType) }}
            </TableCell>
            <TableCell class="px-4 py-3"><AuditOutcome :outcome="event.outcome" /></TableCell>
            <TableCell class="px-4 py-3 wrap-anywhere text-gray-900 dark:text-white">
              {{ labels.actor(event) }}
            </TableCell>
            <TableCell class="px-4 py-3 wrap-anywhere text-gray-900 dark:text-white">
              {{ event.clientAddress }}
            </TableCell>
            <TableCell class="px-4 py-3 text-gray-900 dark:text-white">
              {{ labels.method(event) }}
            </TableCell>
            <TableCell class="px-4 py-3 text-gray-900 dark:text-white">
              {{ event.failureReason ? labels.label('failureReason', event.failureReason) : '–' }}
            </TableCell>
            <TableCell class="px-2 py-1">
              <button
                type="button"
                class="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-medium whitespace-nowrap text-accent-text bg-white dark:bg-gray-900 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
                :aria-expanded="expanded.has(event.id) ? 'true' : 'false'"
                :aria-controls="detailsId(event.id)"
                @click="toggle(event.id)"
              >
                {{
                  expanded.has(event.id) ? t('auditLog.details.hide') : t('auditLog.details.show')
                }}
                <ChevronDownIcon
                  class="size-4 shrink-0"
                  :class="expanded.has(event.id) ? 'rotate-180' : ''"
                />
              </button>
            </TableCell>
          </TableRow>
          <TableRow
            v-if="expanded.has(event.id)"
            :id="detailsId(event.id)"
            class="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/5"
          >
            <TableCell :colspan="COLUMNS.length + 1" class="px-4 py-3">
              <AuditEventDetails :event="event" variant="list" />
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>
</template>

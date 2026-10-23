<script setup lang="ts">
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import { useDataColumns } from '@/shared/composables/useDataList'

import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
// Rspamd's scan history (FR-047, FR-048; plan decisions 12 and 18): cards below md and a table from
// md, with legacy's columns in legacy's order (`draw_rspamd_history`): time, IP address, From (the
// header sender), To (the header recipients, else the envelope recipients), Subject, Action, Score,
// Symbols (always in the details, as legacy), Msg size, Scan Time, ID and Authenticated user.
// Values are untrusted text; legacy's "none" stands for a scan without an authenticated user.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RspamdHistoryEntry } from '@/api'
import { lt, resolveText, legacy, type TextRef } from '@/i18n'
import { formatBytes, formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import PlainText from '@/shared/components/PlainText.vue'
import RowControls from '@/shared/components/RowControls.vue'
import type { SortOrder } from '@/shared/composables/useListState'

import LogBadge from '../../logs/components/LogBadge.vue'
import { formatLogTime } from '../../logs/log-time'
import type { BadgeTone } from '../../logs/log-types'
import type { RspamdSort } from '../list-state'
import RspamdScore from './RspamdScore.vue'
import RspamdSymbols from './RspamdSymbols.vue'

const props = defineProps<{
  entries: readonly RspamdHistoryEntry[]
  expanded: ReadonlySet<string>
  wide: boolean
  sort: RspamdSort
  order: SortOrder
}>()
const emit = defineEmits<{ toggle: [key: string]; sort: [sort: RspamdSort, order: SortOrder] }>()
const { t, locale } = useI18n()
const listId = useId()
const loc = computed(() => locale.value as AppLocale)

/** A stable key of an entry within the shown page. */
const keyOf = (entry: RspamdHistoryEntry, index: number) => `${index}-${entry.time}`

const recipients = (entry: RspamdHistoryEntry) =>
  (entry.headerRecipients.length > 0 ? entry.headerRecipients : entry.envelopeRecipients).join(', ')
const size = (entry: RspamdHistoryEntry) => formatBytes(entry.sizeBytes, loc.value)
const seconds = (value: number) =>
  formatNumber(value, loc.value, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const scanTime = (entry: RspamdHistoryEntry) =>
  entry.scanTimeVirtualSeconds === null
    ? seconds(entry.scanTimeRealSeconds)
    : `${seconds(entry.scanTimeRealSeconds)} / ${seconds(entry.scanTimeVirtualSeconds)}`

function actionTone(action: string): BadgeTone {
  if (action === 'clean' || action === 'no action') return 'success'
  if (['rewrite subject', 'add header', 'probable spam'].includes(action)) return 'warning'
  if (action === 'spam' || action === 'reject') return 'danger'
  return 'info'
}

const LABELS: Record<string, TextRef> = {
  time: legacy('admin.time'),
  ip: 'operations.rspamd.columns.ip',
  from: legacy('admin.from'),
  to: 'operations.rspamd.columns.to',
  subject: legacy('admin.subject'),
  action: legacy('admin.action'),
  score: legacy('quarantine.spam_score'),
  symbols: 'operations.rspamd.columns.symbols',
  size: 'operations.rspamd.columns.size',
  scanTime: 'operations.rspamd.columns.scanTime',
  id: 'operations.rspamd.columns.id',
  user: 'operations.rspamd.columns.user',
}
const label = (key: string) => resolveText(LABELS[key]!, t)

const TABLE: { key: string; sort?: RspamdSort }[] = [
  { key: 'time', sort: 'time' },
  { key: 'ip' },
  { key: 'from' },
  { key: 'to' },
  { key: 'subject' },
  { key: 'action' },
  { key: 'score', sort: 'score' },
  { key: 'size', sort: 'size' },
  { key: 'scanTime', sort: 'scanTime' },
]
const TABLE_DETAILS = ['symbols', 'id', 'user']
const CARD_DETAILS = ['ip', 'symbols', 'size', 'scanTime', 'id', 'user']

function sortBy(sort: RspamdSort) {
  emit('sort', sort, sort === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const detailsId = (key: string) => `${listId}-${key}`

const tableView = useDataColumns(
  () => TABLE.map((column) => ({ id: column.key, label: label(column.key), sort: column.sort })),
  () => ({
    key: props.sort,
    order: props.order,
    change: (key) => sortBy(key as Parameters<typeof sortBy>[0]),
  }),
)
</script>

<template>
  <ul v-if="!wide" data-history-cards class="flex flex-col gap-3">
    <DataCard
      v-for="(entry, index) in entries"
      :key="keyOf(entry, index)"
      :data-entry="keyOf(entry, index)"
      :expanded="expanded.has(keyOf(entry, index))"
      :details-id="detailsId(keyOf(entry, index))"
      :details-label="t('auditLog.details.show')"
      @update:expanded="emit('toggle', keyOf(entry, index))"
    >
      <template #title>
        <time :datetime="entry.time" class="tabular-nums">{{
          formatLogTime(entry.time, loc)
        }}</time>
      </template>
      <template #badges>
        <LogBadge :tone="actionTone(entry.action)" data-cell="action">
          <PlainText :value="entry.action" />
        </LogBadge>
        <span class="sr-only">{{ `${label('score')}: ` }}</span>
        <span data-cell="score">
          <RspamdScore :score="entry.score" :required="entry.requiredScore" />
        </span>
      </template>
      <DataCardFields>
        <div class="flex min-w-0 flex-wrap gap-x-2">
          <dt class="text-gray-600 dark:text-gray-400">{{ label('from') }}</dt>
          <dd class="min-w-0 text-gray-900 dark:text-white">
            <PlainText data-cell="from" :value="entry.headerSender ?? entry.envelopeSender" />
          </dd>
        </div>
        <div class="flex min-w-0 flex-wrap gap-x-2">
          <dt class="text-gray-600 dark:text-gray-400">{{ label('to') }}</dt>
          <dd class="min-w-0 text-gray-900 dark:text-white">
            <PlainText data-cell="to" :value="recipients(entry)" />
          </dd>
        </div>
        <div class="flex min-w-0 flex-wrap gap-x-2">
          <dt class="text-gray-600 dark:text-gray-400">{{ label('subject') }}</dt>
          <dd class="min-w-0 text-gray-900 dark:text-white">
            <PlainText data-cell="subject" :value="entry.subject" />
          </dd>
        </div>
      </DataCardFields>
      <template #details>
        <DataCardFields data-details>
          <div v-for="key in CARD_DETAILS" :key="key" class="min-w-0">
            <dt class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ label(key) }}</dt>
            <dd class="text-gray-900 dark:text-white" :data-cell="key">
              <PlainText v-if="key === 'ip'" :value="entry.clientAddress" />
              <RspamdSymbols v-else-if="key === 'symbols'" :symbols="entry.symbols" />
              <template v-else-if="key === 'size'">{{ size(entry) }}</template>
              <template v-else-if="key === 'scanTime'">{{ scanTime(entry) }}</template>
              <PlainText v-else-if="key === 'id'" :value="entry.messageId" />
              <template v-else-if="key === 'user'">
                <PlainText v-if="entry.user !== null" :value="entry.user" />
                <template v-else>{{ t('operations.logs.none') }}</template>
              </template>
            </dd>
          </div>
        </DataCardFields>
      </template>
    </DataCard>
  </ul>

  <div v-else class="table-frame">
    <table data-history-table class="data-table w-full table-fixed text-sm">
      <caption class="sr-only">
        {{
          lt('debug.history_all_servers')
        }}
      </caption>
      <thead class="border-b border-gray-200 text-start dark:border-gray-800">
        <tr>
          <DataTableHeader
            v-for="column in TABLE"
            :key="column.key"
            :column="String(column.key)"
            class="px-2 py-2 text-start"
          />
          <th scope="col" class="table-controls-cell px-2 py-2 text-end">
            <span class="sr-only">{{ t('domains.list.details') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="(entry, index) in entries" :key="keyOf(entry, index)">
          <tr :data-entry="keyOf(entry, index)" class="align-top text-gray-900 dark:text-white">
            <td
              v-show="tableView.visible(String(tableView.columns.value[0]!.id))"
              :data-column="String(tableView.columns.value[0]!.id)"
              class="px-2 py-2"
              data-cell="time"
            >
              <time :datetime="entry.time" class="min-w-0 tabular-nums">{{
                formatLogTime(entry.time, loc)
              }}</time>
            </td>
            <td
              v-show="tableView.visible(String(tableView.columns.value[1]!.id))"
              :data-column="String(tableView.columns.value[1]!.id)"
              class="px-2 py-2 wrap-anywhere"
              data-cell="ip"
            >
              <PlainText :value="entry.clientAddress" />
            </td>
            <td
              v-show="tableView.visible(String(tableView.columns.value[2]!.id))"
              :data-column="String(tableView.columns.value[2]!.id)"
              class="px-2 py-2 wrap-anywhere"
              data-cell="from"
            >
              <PlainText :value="entry.headerSender ?? entry.envelopeSender" />
            </td>
            <td
              v-show="tableView.visible(String(tableView.columns.value[3]!.id))"
              :data-column="String(tableView.columns.value[3]!.id)"
              class="px-2 py-2 wrap-anywhere"
              data-cell="to"
            >
              <PlainText :value="recipients(entry)" />
            </td>
            <td
              v-show="tableView.visible(String(tableView.columns.value[4]!.id))"
              :data-column="String(tableView.columns.value[4]!.id)"
              class="px-2 py-2 wrap-anywhere"
              data-cell="subject"
            >
              <PlainText :value="entry.subject" />
            </td>
            <td
              v-show="tableView.visible(String(tableView.columns.value[5]!.id))"
              :data-column="String(tableView.columns.value[5]!.id)"
              class="px-2 py-2"
              data-cell="action"
            >
              <LogBadge :tone="actionTone(entry.action)"
                ><PlainText :value="entry.action"
              /></LogBadge>
            </td>
            <td
              v-show="tableView.visible(String(tableView.columns.value[6]!.id))"
              :data-column="String(tableView.columns.value[6]!.id)"
              class="px-2 py-2"
              data-cell="score"
            >
              <RspamdScore :score="entry.score" :required="entry.requiredScore" />
            </td>
            <td
              v-show="tableView.visible(String(tableView.columns.value[7]!.id))"
              :data-column="String(tableView.columns.value[7]!.id)"
              class="px-2 py-2 tabular-nums"
              data-cell="size"
            >
              {{ size(entry) }}
            </td>
            <td
              v-show="tableView.visible(String(tableView.columns.value[8]!.id))"
              :data-column="String(tableView.columns.value[8]!.id)"
              class="px-2 py-2 tabular-nums wrap-anywhere"
              data-cell="scanTime"
            >
              {{ scanTime(entry) }}
            </td>
            <td class="table-controls-cell px-2 py-2 text-end">
              <RowControls
                :expanded="expanded.has(keyOf(entry, index))"
                :controls="
                  expanded.has(keyOf(entry, index)) ? detailsId(keyOf(entry, index)) : undefined
                "
                :label="
                  expanded.has(keyOf(entry, index))
                    ? t('auditLog.details.hide')
                    : t('auditLog.details.show')
                "
                @toggle="emit('toggle', keyOf(entry, index))"
              />
            </td>
          </tr>
          <tr v-if="expanded.has(keyOf(entry, index))" :id="detailsId(keyOf(entry, index))">
            <td
              :colspan="
                TABLE.length + 1 - tableView.columns.value.length + tableView.visibleCount.value
              "
              class="px-2 py-2"
            >
              <dl data-details class="grid gap-2 sm:grid-cols-2">
                <div v-for="key in TABLE_DETAILS" :key="key" class="min-w-0">
                  <dt class="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {{ label(key) }}
                  </dt>
                  <dd class="wrap-anywhere text-gray-900 dark:text-white" :data-cell="key">
                    <RspamdSymbols v-if="key === 'symbols'" :symbols="entry.symbols" />
                    <PlainText v-else-if="key === 'id'" :value="entry.messageId" />
                    <template v-else>
                      <PlainText v-if="entry.user !== null" :value="entry.user" />
                      <template v-else>{{ t('operations.logs.none') }}</template>
                    </template>
                  </dd>
                </div>
              </dl>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

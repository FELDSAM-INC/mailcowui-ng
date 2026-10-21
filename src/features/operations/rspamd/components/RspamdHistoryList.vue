<script setup lang="ts">
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
import type { SortOrder } from '@/shared/composables/useListState'
import { ChevronDownIcon } from '@/shared/icons'

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

function ariaSort(sort: RspamdSort | undefined) {
  if (!sort) return undefined
  if (sort !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}

function sortBy(sort: RspamdSort) {
  emit('sort', sort, sort === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}

const detailsId = (key: string) => `${listId}-${key}`
</script>

<template>
  <ul v-if="!wide" data-history-cards class="flex flex-col gap-3">
    <li
      v-for="(entry, index) in entries"
      :key="keyOf(entry, index)"
      :data-entry="keyOf(entry, index)"
      class="min-w-0 rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-700 dark:text-gray-300">
        <time :datetime="entry.time" class="whitespace-nowrap tabular-nums">{{
          formatLogTime(entry.time, loc)
        }}</time>
        <LogBadge :tone="actionTone(entry.action)" data-cell="action"
          ><PlainText :value="entry.action"
        /></LogBadge>
        <span class="sr-only">{{ `${label('score')}: ` }}</span>
        <span data-cell="score"
          ><RspamdScore :score="entry.score" :required="entry.requiredScore"
        /></span>
      </div>
      <dl class="mt-2 grid gap-1">
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
      </dl>
      <button
        type="button"
        class="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 font-medium text-accent-text bg-white dark:bg-gray-900 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
        :aria-expanded="expanded.has(keyOf(entry, index)) ? 'true' : 'false'"
        :aria-controls="
          expanded.has(keyOf(entry, index)) ? detailsId(keyOf(entry, index)) : undefined
        "
        @click="emit('toggle', keyOf(entry, index))"
      >
        <ChevronDownIcon
          class="size-4"
          :class="expanded.has(keyOf(entry, index)) ? 'rotate-180' : ''"
          aria-hidden="true"
        />
        {{
          expanded.has(keyOf(entry, index))
            ? t('auditLog.details.hide')
            : t('auditLog.details.show')
        }}
      </button>
      <dl
        v-if="expanded.has(keyOf(entry, index))"
        :id="detailsId(keyOf(entry, index))"
        data-details
        class="mt-2 grid gap-2 border-t border-gray-200 pt-2 dark:border-gray-800"
      >
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
      </dl>
    </li>
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
          <th
            v-for="column in TABLE"
            :key="column.key"
            scope="col"
            class="px-2 py-2 text-start"
            :aria-sort="ariaSort(column.sort)"
          >
            <button
              v-if="column.sort"
              type="button"
              :data-sort="column.sort"
              class="inline-flex min-h-11 min-w-11 items-center gap-1 text-start hover:text-gray-900 dark:hover:text-white"
              @click="sortBy(column.sort)"
            >
              {{ label(column.key) }}
              <span aria-hidden="true">{{
                sort === column.sort ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
            <template v-else>{{ label(column.key) }}</template>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <template v-for="(entry, index) in entries" :key="keyOf(entry, index)">
          <tr :data-entry="keyOf(entry, index)" class="align-top text-gray-900 dark:text-white">
            <td class="px-2 py-2" data-cell="time">
              <div class="flex items-start gap-1">
                <button
                  type="button"
                  class="-my-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
                  :aria-label="
                    expanded.has(keyOf(entry, index))
                      ? t('auditLog.details.hide')
                      : t('auditLog.details.show')
                  "
                  :aria-expanded="expanded.has(keyOf(entry, index)) ? 'true' : 'false'"
                  :aria-controls="
                    expanded.has(keyOf(entry, index)) ? detailsId(keyOf(entry, index)) : undefined
                  "
                  @click="emit('toggle', keyOf(entry, index))"
                >
                  <ChevronDownIcon
                    class="size-4"
                    :class="expanded.has(keyOf(entry, index)) ? 'rotate-180' : ''"
                  />
                </button>
                <time :datetime="entry.time" class="min-w-0 tabular-nums">{{
                  formatLogTime(entry.time, loc)
                }}</time>
              </div>
            </td>
            <td class="px-2 py-2 wrap-anywhere" data-cell="ip">
              <PlainText :value="entry.clientAddress" />
            </td>
            <td class="px-2 py-2 wrap-anywhere" data-cell="from">
              <PlainText :value="entry.headerSender ?? entry.envelopeSender" />
            </td>
            <td class="px-2 py-2 wrap-anywhere" data-cell="to">
              <PlainText :value="recipients(entry)" />
            </td>
            <td class="px-2 py-2 wrap-anywhere" data-cell="subject">
              <PlainText :value="entry.subject" />
            </td>
            <td class="px-2 py-2" data-cell="action">
              <LogBadge :tone="actionTone(entry.action)"
                ><PlainText :value="entry.action"
              /></LogBadge>
            </td>
            <td class="px-2 py-2" data-cell="score">
              <RspamdScore :score="entry.score" :required="entry.requiredScore" />
            </td>
            <td class="px-2 py-2 tabular-nums" data-cell="size">{{ size(entry) }}</td>
            <td class="px-2 py-2 tabular-nums wrap-anywhere" data-cell="scanTime">
              {{ scanTime(entry) }}
            </td>
          </tr>
          <tr v-if="expanded.has(keyOf(entry, index))" :id="detailsId(keyOf(entry, index))">
            <td :colspan="TABLE.length" class="px-2 py-2">
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

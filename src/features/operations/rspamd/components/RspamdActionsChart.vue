<script setup lang="ts">
// Rspamd's actions on this server (FR-046, FR-083; plan decision 19): instead of legacy's doughnut,
// one horizontal bar per action as Rspamd names it, labelled "{action} {percent}" as legacy labels
// its slices, with the count in text, a one-sentence summary, and a switch to a table with the same
// figures. The bars are decorative (their width is a CSSOM binding); "No messages were scanned
// yet." replaces them when every count is zero.
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RspamdStatistics } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import PlainText from '@/shared/components/PlainText.vue'
import { buttonVariants } from '@/shared/ui/button'

const props = defineProps<{ statistics: RspamdStatistics }>()
const { t, locale } = useI18n()
const tableId = useId()
const showTable = ref(false)

const rows = computed(() => {
  const entries = Object.entries(props.statistics.actions)
  const sum = entries.reduce((total, [, count]) => total + count, 0)
  const total = props.statistics.scanned > 0 ? props.statistics.scanned : sum
  return entries.map(([action, count]) => ({
    action,
    count,
    share: total > 0 ? count / total : 0,
  }))
})
const empty = computed(() => rows.value.every((row) => row.count === 0))
const loc = computed(() => locale.value as AppLocale)
const percent = (share: number) =>
  formatNumber(share, loc.value, { style: 'percent', maximumFractionDigits: 0 })
const number = (value: number) => formatNumber(value, loc.value)
const top = computed(() => [...rows.value].sort((a, b) => b.count - a.count)[0])
const width = (share: number) => `${Math.max(0, Math.min(100, Math.round(share * 100)))}%`
</script>

<template>
  <p v-if="empty" data-none-scanned class="text-gray-600 dark:text-gray-400">
    {{ t('operations.rspamd.noneScanned') }}
  </p>
  <div v-else class="flex flex-col gap-3">
    <p v-if="top" data-summary class="text-gray-800 dark:text-gray-200">
      {{ t('operations.rspamd.summary', { percent: percent(top.share), action: top.action }) }}
    </p>
    <ul class="flex flex-col gap-3">
      <li v-for="row in rows" :key="row.action" :data-action="row.action" class="min-w-0">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span class="font-medium text-gray-900 dark:text-white"
            ><PlainText :value="row.action" /> {{ percent(row.share) }}</span
          >
          <span class="text-gray-600 dark:text-gray-400">{{
            t('operations.rspamd.count', { count: number(row.count) })
          }}</span>
        </div>
        <div class="mt-1 h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            data-bar
            aria-hidden="true"
            class="h-3 rounded-full bg-chart-1"
            :style="{ width: width(row.share) }"
          />
        </div>
      </li>
    </ul>
    <div>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
        :aria-expanded="showTable ? 'true' : 'false'"
        :aria-controls="showTable ? tableId : undefined"
        @click="showTable = !showTable"
      >
        {{ showTable ? t('operations.charts.hideTable') : t('operations.charts.showTable') }}
      </button>
    </div>
    <div v-if="showTable" class="table-frame">
      <table :id="tableId" class="data-table w-full text-sm">
        <caption class="text-start font-medium text-gray-900 dark:text-white">
          {{
            lt('debug.chart_this_server')
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col" class="px-2 py-2 text-start">{{ lt('admin.action') }}</th>
            <th scope="col" class="px-2 py-2 text-end">
              {{ t('operations.rspamd.messages') }}
            </th>
            <th scope="col" class="px-2 py-2 text-end">
              {{ t('operations.rspamd.share') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
          <tr v-for="row in rows" :key="row.action" class="text-gray-900 dark:text-white">
            <th scope="row" class="px-2 py-2 text-start font-normal wrap-anywhere">
              <PlainText :value="row.action" />
            </th>
            <td class="px-2 py-2 text-end tabular-nums">{{ number(row.count) }}</td>
            <td class="px-2 py-2 text-end tabular-nums">{{ percent(row.share) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
// The spam filter's actions as a table of text (UI 006 US8, FR-065, FR-079, legacy form map screen
// 9, D8): legacy's Rspamd action names in legacy order, each with its count and its share of the
// total in the user's number format, a decorative bar (hidden from assistive technology; its width
// is the only bound style), the total, and the counting period when the API knows it.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SpamFilterActionStatistics } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'

import { SHARE_FORMAT, statisticRows } from '../../statistics'

const props = defineProps<{ statistics: SpamFilterActionStatistics }>()
const { t } = useI18n()
const fmt = useFormat()

const rows = computed(() => statisticRows(props.statistics))
const period = computed(() => [
  props.statistics.countedSince
    ? t('quarantineUi.statistics.countedSince', {
        date: fmt.dateTime(props.statistics.countedSince),
      })
    : t('quarantineUi.statistics.countedSinceUnknown'),
  ...(props.statistics.spamFilterRunningSince
    ? [
        t('quarantineUi.statistics.runningSince', {
          date: fmt.dateTime(props.statistics.spamFilterRunningSince),
        }),
      ]
    : []),
])
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
  >
    <table data-statistics class="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr class="border-b border-gray-200 text-start dark:border-gray-800">
          <th
            scope="col"
            class="w-2/5 py-2 pe-2 text-start font-medium text-gray-700 dark:text-gray-300"
          >
            {{ lt('quarantine.action') }}
          </th>
          <th scope="col" class="py-2 pe-2 text-end font-medium text-gray-700 dark:text-gray-300">
            {{ t('quarantineUi.statistics.count') }}
          </th>
          <th scope="col" class="py-2 text-end font-medium text-gray-700 dark:text-gray-300">
            {{ t('quarantineUi.statistics.share') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.action"
          :data-action="row.action"
          class="border-b border-gray-100 align-top dark:border-gray-800"
        >
          <th
            scope="row"
            class="py-2 pe-2 text-start font-normal wrap-anywhere text-gray-900 dark:text-white"
          >
            {{ t(row.labelKey) }}
            <span
              aria-hidden="true"
              data-bar-track
              class="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
            >
              <span
                data-bar
                class="block h-full rounded-full bg-brand-500 dark:bg-brand-400"
                :style="{ width: `${row.width}%` }"
              />
            </span>
          </th>
          <td data-count class="py-2 pe-2 text-end text-gray-900 tabular-nums dark:text-white">
            {{ fmt.number(row.count) }}
          </td>
          <td data-share class="py-2 text-end text-gray-900 tabular-nums dark:text-white">
            {{ fmt.number(row.share, SHARE_FORMAT) }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr data-total>
          <th scope="row" class="pt-2 pe-2 text-start font-semibold text-gray-900 dark:text-white">
            {{ t('quarantineUi.statistics.total') }}
          </th>
          <td class="pt-2 pe-2 text-end font-semibold text-gray-900 tabular-nums dark:text-white">
            {{ fmt.number(statistics.total) }}
          </td>
          <td class="pt-2" />
        </tr>
      </tfoot>
    </table>
    <p data-period class="text-sm text-gray-600 dark:text-gray-400">
      <span v-for="line in period" :key="line" class="block">{{ line }}</span>
    </p>
  </div>
</template>

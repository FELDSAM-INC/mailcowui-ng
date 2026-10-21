<script setup lang="ts">
// The report of a rename that could neither finish nor be undone, or whose outcome is unknown
// (US8-AS5, FR-052): an alert that stays until it is dismissed, with both addresses, every step with
// its outcome, the step whose outcome is unknown, and the advice for the server operator. Legacy has
// no such report; its texts are new strings.
import { useI18n } from 'vue-i18n'

import { text } from '@/i18n'

import { renameOutcomeKey, renameStepKey } from '../../labels'
import type { RenameReportView } from '../../problems'

defineProps<{ report: RenameReportView; message: string }>()
const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()
</script>

<template>
  <div
    role="alert"
    data-rename-report
    :data-kind="report.kind"
    class="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
  >
    <p class="font-semibold">{{ t('mailboxes.rename.report.title') }}</p>
    <p>{{ message }}</p>
    <ul class="flex flex-col gap-0.5 wrap-anywhere">
      <li>{{ t('mailboxes.rename.report.previous', { address: report.previousAddress }) }}</li>
      <li>{{ t('mailboxes.rename.report.next', { address: report.newAddress }) }}</li>
    </ul>
    <p v-if="report.unknownStep" data-unknown-step>
      {{
        t('mailboxes.rename.report.unknownStep', {
          step: text(renameStepKey(report.unknownStep as never)),
        })
      }}
    </p>
    <div v-if="report.steps.length > 0" class="table-frame">
      <table class="data-table w-full text-start">
        <caption class="text-start font-medium">
          {{
            t('mailboxes.rename.report.steps')
          }}
        </caption>
        <tbody>
          <tr v-for="item in report.steps" :key="item.step" :data-step="item.step">
            <th scope="row" class="py-1 pe-3 text-start font-normal">
              {{ text(renameStepKey(item.step)) }}
            </th>
            <td class="py-1" :data-outcome="item.outcome">
              {{ text(renameOutcomeKey(item.outcome)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-lg border border-red-300 bg-white px-4 font-medium text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900"
        @click="emit('dismiss')"
      >
        {{ t('common.close') }}
      </button>
    </div>
  </div>
</template>

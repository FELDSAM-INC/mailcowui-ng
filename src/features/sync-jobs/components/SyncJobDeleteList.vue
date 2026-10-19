<script setup lang="ts">
// The jobs a removal or a deactivation affects (FR-036, FR-037, FR-039), inside the confirmation:
// for a removal legacy's lead-in (`footer.delete_these_items`), then each job by ID, label and
// owner in a scrollable, named list, then what the action does to them (copied mail stays; they do
// not run until activated again) and, when one is running, that the run finishes on its own.
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

export interface AffectedJob {
  id: number
  label: string
  mailbox: string
  running: boolean
}

defineProps<{ jobs: readonly AffectedJob[]; kind: 'delete' | 'deactivate'; showOwner: boolean }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="kind === 'delete'">{{ lt('footer.delete_these_items') }}</p>
    <!-- eslint-disable-next-line vuejs-accessibility/no-noninteractive-tabindex -- a scrollable region must take focus -->
    <ul
      :aria-label="t('syncJobs.bulk.listLabel')"
      tabindex="0"
      class="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-gray-200 p-2 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800"
    >
      <li v-for="job in jobs" :key="job.id" class="wrap-anywhere">
        <span class="font-medium text-gray-900 dark:text-white">{{ job.id }}: {{ job.label }}</span>
        <span v-if="showOwner" class="block text-gray-600 dark:text-gray-400">{{
          job.mailbox
        }}</span>
      </li>
    </ul>
    <p>
      {{ kind === 'delete' ? t('syncJobs.delete.mailKept') : t('syncJobs.bulk.deactivateNote') }}
    </p>
    <p v-if="jobs.some((job) => job.running)">{{ t('syncJobs.running.note') }}</p>
  </div>
</template>

<script setup lang="ts">
// The run status on the job page (FR-015): display-only, with the data and the keys of the
// classic table (conventions "Detail pages"): the owner (not for mailbox users), the last run, the
// last run result ("Check log" as text: the log stays in the list) and the status.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role, SyncJob } from '@/api'
import { resolveText, type TextRef } from '@/i18n'

import { listTexts } from '../presentation'
import SyncJobLastRun from './SyncJobLastRun.vue'
import SyncJobResult from './SyncJobResult.vue'
import SyncJobStateBadges from './SyncJobStateBadges.vue'

const props = defineProps<{ job: SyncJob; role: Role }>()
const { t } = useI18n()
const texts = computed(() => listTexts(props.role))
const label = (ref: TextRef) => resolveText(ref, t)
</script>

<template>
  <dl
    data-run-status
    class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900"
  >
    <template v-if="role !== 'mailboxUser'">
      <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.owner) }}</dt>
      <dd class="wrap-anywhere text-gray-900 dark:text-white">{{ job.mailbox }}</dd>
    </template>
    <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.lastRun) }}</dt>
    <dd class="text-gray-900 dark:text-white">
      <SyncJobLastRun :run="job.runStatus" :role="role" />
    </dd>
    <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.result) }}</dt>
    <dd class="text-gray-900 dark:text-white">
      <SyncJobResult :run="job.runStatus" :role="role" />
    </dd>
    <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.status) }}</dt>
    <dd>
      <SyncJobStateBadges :active="job.active" :running="job.runStatus.running" :role="role" />
    </dd>
  </dl>
</template>

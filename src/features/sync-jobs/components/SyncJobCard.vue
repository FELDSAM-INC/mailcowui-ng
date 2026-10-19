<script setup lang="ts">
// A sync job as a card below md (FR-005, FR-008): the classic "Server" value as heading with a link
// to the job page, then the table's columns and its collapsed values, each labelled with the
// classic column key of the role's table. Slots: `select` (selection mode) and `actions`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Role, SyncJob } from '@/api'
import { resolveText } from '@/i18n'
import { useFormat } from '@/i18n/format'

import { jobLabel, listTexts } from '../presentation'
import SyncJobLastRun from './SyncJobLastRun.vue'
import SyncJobResult from './SyncJobResult.vue'
import SyncJobStateBadges from './SyncJobStateBadges.vue'

const props = defineProps<{ job: SyncJob; role: Role }>()
const emit = defineEmits<{ openLog: [job: SyncJob] }>()
const { t } = useI18n()
const fmt = useFormat()
const texts = computed(() => listTexts(props.role))
const manager = computed(() => props.role !== 'mailboxUser')
const id = computed(() => `sync-job-card-${props.job.id}`)
const label = (ref: Parameters<typeof resolveText>[0]) => resolveText(ref, t)
</script>

<template>
  <li
    :data-entry="job.id"
    class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <article :aria-labelledby="`${id}-name`" class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <slot name="select" />
        <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
        <h3
          :id="`${id}-name`"
          class="min-w-0 flex-1 text-base font-semibold wrap-anywhere text-gray-900 dark:text-white"
        >
          <RouterLink
            :to="{ name: 'sync-job-detail', params: { syncJobId: job.id } }"
            class="flex min-h-11 w-full min-w-0 items-center wrap-anywhere underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {{ jobLabel(job) }}
          </RouterLink>
        </h3>
        <slot name="actions" />
      </div>
      <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <dt class="text-gray-600 dark:text-gray-400">{{ t('syncJobs.columns.id') }}</dt>
        <dd class="text-gray-900 dark:text-white">{{ job.id }}</dd>
        <template v-if="manager">
          <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.owner) }}</dt>
          <dd class="wrap-anywhere text-gray-900 dark:text-white">{{ job.mailbox }}</dd>
        </template>
        <template v-else>
          <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.username) }}</dt>
          <dd class="wrap-anywhere text-gray-900 dark:text-white">{{ job.remoteUser }}</dd>
        </template>
        <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.lastRun) }}</dt>
        <dd class="text-gray-900 dark:text-white">
          <SyncJobLastRun :run="job.runStatus" :role="role" />
        </dd>
        <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.result) }}</dt>
        <dd class="text-gray-900 dark:text-white">
          <SyncJobResult
            :run="job.runStatus"
            :role="role"
            log-link
            @open-log="emit('openLog', job)"
          />
        </dd>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('syncJobs.columns.log') }}</dt>
        <dd>
          <button
            type="button"
            class="min-h-11 text-start font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
            @click="emit('openLog', job)"
          >
            {{ label(texts.openLogs) }}
          </button>
        </dd>
        <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.active) }}</dt>
        <dd class="text-gray-900 dark:text-white">
          <SyncJobStateBadges
            show="active"
            :active="job.active"
            :running="job.runStatus.running"
            :role="role"
          />
        </dd>
        <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.status) }}</dt>
        <dd>
          <SyncJobStateBadges :active="job.active" :running="job.runStatus.running" :role="role" />
        </dd>
        <template v-if="!manager">
          <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.encryption) }}</dt>
          <dd class="text-gray-900 dark:text-white">
            {{ t(`enums.syncJobEncryption.${job.encryption}`) }}
          </dd>
        </template>
        <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.excludes) }}</dt>
        <dd class="wrap-anywhere text-gray-900 dark:text-white">
          <code v-if="job.exclude">{{ job.exclude }}</code>
          <template v-else>-</template>
        </dd>
        <dt class="text-gray-600 dark:text-gray-400">
          {{ label(texts.interval)
          }}<template v-if="!manager">{{ ` ${t('syncJobs.columns.minutes')}` }}</template>
        </dt>
        <dd class="text-gray-900 dark:text-white">{{ fmt.number(job.intervalMinutes) }}</dd>
      </dl>
    </article>
  </li>
</template>

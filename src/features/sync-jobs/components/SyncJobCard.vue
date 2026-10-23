<script setup lang="ts">
import ActiveBadge from '@/shared/components/ActiveBadge.vue'

import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

// A sync job as a card below md (FR-005, FR-008): the classic "Server" value as heading with a link
// to the job page, then the table's columns and its collapsed values, each labelled with the
// classic column key of the role's table. Slots: `select` (selection mode) and `actions`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role, SyncJob } from '@/api'
import { resolveText } from '@/i18n'
import { useFormat } from '@/i18n/format'

import { jobLabel, listTexts } from '../presentation'
import SyncJobLastRun from './SyncJobLastRun.vue'
import SyncJobResult from './SyncJobResult.vue'
import SyncJobStateBadges from './SyncJobStateBadges.vue'

const props = defineProps<{ job: SyncJob; role: Role }>()
const { t } = useI18n()
const fmt = useFormat()
const texts = computed(() => listTexts(props.role))
const manager = computed(() => props.role !== 'mailboxUser')
const id = computed(() => `sync-job-card-${props.job.id}`)
const label = (ref: Parameters<typeof resolveText>[0]) => resolveText(ref, t)
</script>

<template>
  <DataCard
    :data-entry="job.id"
    :title-id="`${id}-name`"
    :title="jobLabel(job)"
    :to="{ name: 'sync-job-detail', params: { syncJobId: job.id } }"
  >
    <template #badges><ActiveBadge :active="job.active" /></template
    ><template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <DataCardFields>
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
        <SyncJobResult :run="job.runStatus" :role="role" />
      </dd>

      <dt class="text-gray-600 dark:text-gray-400">{{ label(texts.status) }}</dt>
      <dd>
        <SyncJobStateBadges :active="job.active" :running="job.runStatus.running" :role="role" />
      </dd>
    </DataCardFields>
    <template #details>
      <DataCardFields>
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
          {{ label(texts.interval) + (manager ? '' : ` ${t('syncJobs.columns.minutes')}`) }}
        </dt>
        <dd class="text-gray-900 dark:text-white">{{ fmt.number(job.intervalMinutes) }}</dd>
      </DataCardFields>
    </template>
  </DataCard>
</template>

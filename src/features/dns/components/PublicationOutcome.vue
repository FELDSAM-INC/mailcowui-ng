<script setup lang="ts">
// The outcome of a DKIM DNS publication to the ISPConfig zone (research R16, FR-043 to FR-045): shown
// only while the server publishes records. The status as icon and text; for a failure its reason,
// translated from the code (an unknown code shows the generic failure), and the technical detail as
// plain English text; advice for a failure or a missing zone, with the `action` slot ("Publish DNS
// record again", US7). Legacy publishes silently, so every text is a new string.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DkimDnsPublicationOutcome } from '@/api'
import { hasMessage } from '@/i18n'
import { CheckIcon, DangerIcon, InfoIcon, WarningIcon } from '@/shared/icons'

const props = defineProps<{ outcome: DkimDnsPublicationOutcome; enabled: boolean }>()
const { t } = useI18n()

const ICONS = {
  published: CheckIcon,
  removed: CheckIcon,
  noRecordToRemove: InfoIcon,
  notConfigured: InfoIcon,
  noZone: WarningIcon,
  failed: DangerIcon,
} as const

const TONES = {
  published: 'text-green-700 dark:text-green-400',
  removed: 'text-green-700 dark:text-green-400',
  noRecordToRemove: 'text-gray-700 dark:text-gray-300',
  notConfigured: 'text-gray-700 dark:text-gray-300',
  noZone: 'text-amber-800 dark:text-amber-300',
  failed: 'text-red-700 dark:text-red-400',
} as const

const status = computed(() => props.outcome.status)
const icon = computed(() => ICONS[status.value] ?? InfoIcon)
const reasonText = computed(() => {
  const code = props.outcome.reason?.code
  const key = `dns.publication.reasons.${code}`
  return code && hasMessage(key) ? t(key) : t('dns.publication.reasons.unknown')
})
const offersAction = computed(() => status.value === 'failed' || status.value === 'noZone')
</script>

<template>
  <div
    v-if="enabled"
    data-publication-outcome
    :data-status="status"
    class="flex flex-col gap-1 text-sm text-gray-800 dark:text-gray-200"
  >
    <p class="inline-flex flex-wrap items-center gap-1 font-medium" :class="TONES[status]">
      <component :is="icon" class="size-4 shrink-0" />
      <span class="sr-only">{{ t('dns.publication.title') }}:</span>
      {{ t(`dns.publication.status.${status}`) }}
    </p>
    <template v-if="status === 'failed'">
      <p data-publication-reason>{{ reasonText }}</p>
      <p v-if="outcome.reason?.detail" class="break-words">
        {{ t('dns.publication.detail') }}:
        <span lang="en" data-publication-detail class="font-mono">{{ outcome.reason.detail }}</span>
      </p>
      <p>{{ t('dns.publication.advice.failed') }}</p>
    </template>
    <p v-else-if="status === 'noZone'">{{ t('dns.publication.advice.noZone') }}</p>
    <div v-if="offersAction && $slots.action" class="mt-1">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
// The outcomes of a domain creation as the classic interface's alerts (FR-026, docs/conventions.md
// "Outcomes"): one alert per outcome with legacy's text, by text, colour and icon, announced
// politely. They stay until closed or the page is left. The API's English messages are never
// shown.
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DomainCreationReport } from '@/api'
import { resolveText } from '@/i18n'
import { isLegacyRef } from '@/i18n/text'
import { announce } from '@/shared/composables/useAnnouncer'
import { CheckIcon, CloseIcon, DangerIcon, WarningIcon } from '@/shared/icons'

import { creationAlerts, type AlertKind, type CreationAlert } from '../../creation-report'

const props = defineProps<{ name: string; report: DomainCreationReport }>()
const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()

const alerts = computed(() => creationAlerts(props.name, props.report))
const ICONS: Record<AlertKind, typeof CheckIcon> = {
  success: CheckIcon,
  warning: WarningIcon,
  danger: DangerIcon,
}
const TONE: Record<AlertKind, string> = {
  success:
    'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100',
  danger:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100',
}
const text = (alert: CreationAlert) =>
  isLegacyRef(alert.text) || alert.params.length === 0
    ? resolveText(alert.text, t)
    : t(alert.text, alert.params)

onMounted(() => announce(alerts.value.map(text).join(' ')))
</script>

<template>
  <div data-creation-report class="flex items-start gap-2">
    <ul class="flex min-w-0 flex-1 flex-col gap-2">
      <li
        v-for="(alert, index) in alerts"
        :key="index"
        :data-alert="alert.kind"
        class="flex gap-2 rounded-xl border p-3 text-sm"
        :class="TONE[alert.kind]"
      >
        <component :is="ICONS[alert.kind]" class="mt-0.5 size-4 shrink-0" />
        <span class="min-w-0 break-words">{{ text(alert) }}</span>
      </li>
    </ul>
    <button
      type="button"
      class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
      :aria-label="t('common.close')"
      @click="emit('dismiss')"
    >
      <CloseIcon class="size-5" />
    </button>
  </div>
</template>

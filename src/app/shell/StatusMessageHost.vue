<script setup lang="ts">
// The app-level status messages (UI 011 research R8, FR-078): a status region in the shell that
// lists the messages of `useStatusMessage()` until each is dismissed. Dismissing moves the focus to
// the next message, or to the main content when none is left.
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useStatusMessage, type StatusTone } from '@/shared/composables/useStatusMessage'
import { CheckIcon, CloseIcon, DangerIcon, InfoIcon, WarningIcon } from '@/shared/icons'

const { t } = useI18n()
const { messages, dismiss } = useStatusMessage()
const list = ref<HTMLElement | null>(null)

const TONES: Record<StatusTone, string> = {
  success:
    'border-success-200 bg-success-50 text-success-800 dark:border-success-900 dark:bg-success-950 dark:text-success-100',
  info: 'border-gray-200 bg-white text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200',
  warning:
    'border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100',
  danger:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
}
const ICONS = { success: CheckIcon, info: InfoIcon, warning: WarningIcon, danger: DangerIcon }

async function close(id: number, index: number) {
  dismiss(id)
  await nextTick()
  const buttons = list.value?.querySelectorAll<HTMLButtonElement>('[data-dismiss]') ?? []
  const next = buttons[Math.min(index, buttons.length - 1)]
  if (next) next.focus()
  else document.getElementById('main')?.focus()
}
</script>

<template>
  <div ref="list" role="status" data-status-messages class="flex flex-col gap-3 empty:hidden">
    <div
      v-for="(message, index) in messages"
      :key="message.id"
      data-status-message
      class="flex items-start gap-3 rounded-xl border p-4"
      :class="TONES[message.tone]"
    >
      <component :is="ICONS[message.tone]" class="mt-0.5 size-5 shrink-0" />
      <p class="min-w-0 flex-1 break-words">{{ message.text }}</p>
      <button
        type="button"
        data-dismiss
        class="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-current dark:hover:bg-white/10"
        :aria-label="t('common.close')"
        @click="close(message.id, index)"
      >
        <CloseIcon class="size-5" />
      </button>
    </div>
  </div>
</template>

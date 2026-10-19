<script setup lang="ts">
// One outcome as the classic interface shows it (docs/conventions.md "Outcomes"): legacy's
// success, warning or danger text in an alert that stays until it is closed, announced politely.
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { announce } from '../composables/useAnnouncer'
import { CheckIcon, CloseIcon, DangerIcon, WarningIcon } from '../icons'

const props = withDefaults(
  defineProps<{ message: string; kind?: 'success' | 'warning' | 'danger' }>(),
  { kind: 'success' },
)
const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()
const TONE = {
  success:
    'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100',
  danger:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100',
} as const
const ICONS = { success: CheckIcon, warning: WarningIcon, danger: DangerIcon } as const

onMounted(() => announce(props.message))
</script>

<template>
  <div
    :data-alert="kind"
    class="flex items-start gap-2 rounded-xl border p-3 text-sm"
    :class="TONE[kind]"
  >
    <component :is="ICONS[kind]" class="mt-0.5 size-4 shrink-0" />
    <p class="min-w-0 flex-1 break-words">{{ message }}</p>
    <button
      type="button"
      class="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-white/10"
      :aria-label="t('common.close')"
      @click="emit('dismiss')"
    >
      <CloseIcon class="size-5" />
    </button>
  </div>
</template>

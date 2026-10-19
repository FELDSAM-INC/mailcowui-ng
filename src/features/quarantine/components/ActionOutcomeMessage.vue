<script setup lang="ts">
// The outcome of an item action as legacy shows it (UI 006 legacy form map part 2, D15, FR-071):
// one alert per outcome (success, warning or danger), in order. The texts can carry the spam
// filter's or the mail server's answer, so each goes through PlainText. The alerts are announced
// when they appear and stay until they are closed, so they never disappear while focused or
// hovered.
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PlainText from '@/shared/components/PlainText.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { CheckIcon, CloseIcon, DangerIcon, WarningIcon } from '@/shared/icons'

import type { OutcomeLine } from '../action-outcome'
import { inertText } from '../plain'

const props = withDefaults(
  defineProps<{ lines: readonly OutcomeLine[]; dismissible?: boolean }>(),
  { dismissible: true },
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

function announceLines() {
  if (props.lines.length === 0) return
  const assertive = props.lines.some((line) => line.kind === 'danger')
  announce(props.lines.map((line) => inertText(line.text)).join(' '), { assertive })
}

onMounted(announceLines)
watch(() => props.lines, announceLines)
</script>

<template>
  <div v-if="lines.length > 0" data-outcome class="flex items-start gap-2">
    <ul class="flex min-w-0 flex-1 flex-col gap-2">
      <li
        v-for="(line, index) in lines"
        :key="index"
        :data-alert="line.kind"
        class="flex items-start gap-2 rounded-xl border p-3 text-sm"
        :class="TONE[line.kind]"
      >
        <component :is="ICONS[line.kind]" class="mt-0.5 size-4 shrink-0" />
        <p class="min-w-0 flex-1 break-words"><PlainText :value="line.text" /></p>
      </li>
    </ul>
    <button
      v-if="dismissible"
      type="button"
      class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/10"
      :aria-label="t('common.close')"
      @click="emit('dismiss')"
    >
      <CloseIcon class="size-5" />
    </button>
  </div>
</template>

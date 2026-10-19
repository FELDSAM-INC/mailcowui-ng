<script setup lang="ts">
// The state of a diagnostics run (research R14, FR-058, FR-066, FR-069, FR-091): running, with
// the time it can take; a timeout, a refusal for too many runs or another failure, saying that the
// result shown is the previous one; the runs left from three down; "Run again", unavailable while
// a run is going and until the rate limit resets, which is announced once.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { isApiProblem } from '@/api'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { useCountdown } from '@/shared/composables/useCountdown'
import { SyncIcon, WarningIcon } from '@/shared/icons'
import { useFormat } from '@/i18n/format'
import { buttonVariants } from '@/shared/ui/button'

import { isDiagnosticsTimeout } from '../api/diagnostics'
import { showRemaining, type RateLimitState } from '../diagnostics/rate-limit'

const props = defineProps<{
  running: boolean
  error: unknown
  rateLimit: RateLimitState | undefined
  runTimeoutSeconds: number
  hasResult: boolean
}>()
const emit = defineEmits<{ runAgain: [] }>()
const { t } = useI18n()
const fmt = useFormat()
const { problemMessage } = useProblemMessages()

const deadline = computed(() =>
  props.rateLimit && props.rateLimit.remaining === 0 ? props.rateLimit.resetAt : null,
)
let counted = false
const countdown = useCountdown({
  deadline: () => deadline.value,
  onExpire: () => {
    if (counted) announce(t('dns.diagnostics.run.availableAgain'))
    counted = false
    expiredAt.value = Date.now()
  },
})
const expiredAt = ref(0)
const blocked = computed(() => {
  const value = deadline.value !== null && countdown.remaining.value > 0
  if (value) counted = true
  return value
})
const remainingNotice = computed(
  () => !blocked.value && showRemaining(props.rateLimit, Date.now() + 0 * expiredAt.value),
)

const errorText = computed(() => {
  const error = props.error
  if (!error) return null
  if (isDiagnosticsTimeout(error))
    return t('dns.diagnostics.run.timeout', { seconds: error.seconds })
  if (isApiProblem(error)) return problemMessage(error)
  return null
})
</script>

<template>
  <div data-run-status class="flex flex-col gap-3">
    <div
      v-if="running"
      role="status"
      class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
    >
      <SyncIcon class="size-5 shrink-0 motion-safe:animate-spin" />
      {{ t('dns.diagnostics.run.running', { seconds: fmt.number(runTimeoutSeconds) }) }}
    </div>
    <div
      v-else-if="error"
      role="alert"
      data-run-error
      class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      <WarningIcon class="mt-0.5 size-5 shrink-0" />
      <div class="flex flex-col gap-1">
        <p v-if="!isDiagnosticsTimeout(error)" class="font-semibold">
          {{ t('dns.diagnostics.run.failed') }}
        </p>
        <p v-if="errorText">{{ errorText }}</p>
        <p v-if="hasResult">{{ t('dns.diagnostics.run.previous') }}</p>
      </div>
    </div>
    <p v-if="blocked" data-run-blocked class="text-sm text-gray-800 dark:text-gray-200">
      {{ t('dns.diagnostics.run.availableIn', { time: fmt.duration(countdown.remaining.value) }) }}
    </p>
    <p
      v-else-if="remainingNotice"
      data-run-remaining
      class="text-sm text-gray-800 dark:text-gray-200"
    >
      {{ t('dns.diagnostics.run.remaining', { count: fmt.number(rateLimit?.remaining ?? 0) }) }}
    </p>
    <div>
      <button
        type="button"
        data-run-again
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="running || blocked"
        @click="emit('runAgain')"
      >
        <SyncIcon />
        {{ t('dns.diagnostics.run.again') }}
      </button>
    </div>
  </div>
</template>

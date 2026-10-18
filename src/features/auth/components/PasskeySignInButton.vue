<script setup lang="ts">
// The passkey sign-in action (FR-010, FR-013, FR-014, US2-AS6): the first and most prominent
// sign-in action, rendered only on devices with passkey support. It shows the busy state, the
// translated outcome of a failed attempt, and the throttling countdown.
import { useI18n } from 'vue-i18n'

import type { ApiProblem } from '@/api'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { PasskeyIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

defineProps<{
  pending: boolean
  throttled: boolean
  countdown: string
  problem: ApiProblem | null
  messageKey: string | null
  chooseAgain: boolean
}>()
defineEmits<{ start: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-3">
    <ProblemMessage :problem="problem" />
    <p
      v-if="messageKey"
      role="alert"
      class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      {{ t(messageKey) }}
    </p>
    <p v-else-if="chooseAgain" class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('auth.passkey.chooseAgain') }}
    </p>
    <p v-if="throttled" class="text-sm font-medium text-gray-800 tabular-nums dark:text-gray-200">
      {{ t('auth.signIn.throttle.countdown', { time: countdown }) }}
    </p>
    <button
      type="button"
      data-variant="primary"
      :class="buttonVariants({ class: 'w-full' })"
      :disabled="pending || throttled"
      :aria-busy="pending ? 'true' : 'false'"
      @click="$emit('start')"
    >
      <PasskeyIcon class="size-5" />
      {{ pending ? t('auth.passkey.waiting') : t('auth.passkey.signIn') }}
    </button>
  </div>
</template>

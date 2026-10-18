// The time limit of a pending sign-in (FR-025, research R13): it counts down to
// `PendingSignIn.expiresAt` against the server clock, warns and announces when one minute is left,
// and reports the expiry. The limit cannot be extended (spec Assumptions, WCAG 2.2.1 "essential").
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSessionStore } from '@/app/session/store'
import { formatClock } from '@/i18n/format'
import { announce } from '@/shared/composables/useAnnouncer'
import { useCountdown } from '@/shared/composables/useCountdown'

export const PENDING_SIGN_IN_WARNING_SECONDS = 60

export function usePendingSignInTimer(
  expiresAt: () => string | null | undefined,
  onExpire: () => void,
) {
  const { t } = useI18n()
  const store = useSessionStore()
  const warned = ref(false)
  const countdown = useCountdown({
    deadline: expiresAt,
    skew: () => store.clockSkew,
    milestones: [PENDING_SIGN_IN_WARNING_SECONDS],
    onMilestone: () => {
      warned.value = true
      announce(t('auth.secondFactor.oneMinute'), { assertive: true })
    },
    onExpire,
  })
  return {
    remaining: countdown.remaining,
    clock: computed(() => formatClock(countdown.remaining.value)),
    warned,
  }
}

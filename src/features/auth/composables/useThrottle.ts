// Throttled sign-in (`429 too-many-requests`, US1-AS6, research R13). The server's `retryAfter`
// disables sign-in until then. A visible countdown updates every second, but it is announced only
// when it starts and when sign-in is possible again. Component state only: a reload forgets it,
// and a new attempt simply gets 429 again.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFormat } from '@/i18n/format'
import { announce } from '@/shared/composables/useAnnouncer'
import { useCountdown } from '@/shared/composables/useCountdown'

/** Used when a 429 carries no retry time. */
const FALLBACK_SECONDS = 60

export function useThrottle() {
  const { t } = useI18n()
  const fmt = useFormat()
  const until = ref<number | null>(null)

  const countdown = useCountdown({
    deadline: () => until.value,
    onExpire: () => {
      until.value = null
      announce(t('auth.signIn.throttle.ended'))
    },
  })

  function start(retryAfter: number | null | undefined) {
    const seconds = retryAfter && retryAfter > 0 ? retryAfter : FALLBACK_SECONDS
    until.value = Date.now() + seconds * 1000
    announce(t('auth.signIn.throttle.announce', { time: fmt.duration(seconds) }), {
      assertive: true,
    })
  }

  return {
    active: computed(() => until.value !== null),
    remaining: countdown.remaining,
    clock: computed(() => fmt.clock(countdown.remaining.value)),
    start,
  }
}

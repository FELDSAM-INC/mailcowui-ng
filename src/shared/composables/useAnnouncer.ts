// Screen reader announcements (FR-078, FR-082, research R20): one polite and one assertive live
// region, rendered once by LiveAnnouncer.vue in App.vue. Announcing never moves focus. The region
// is cleared first and filled a moment later, so a repeated message is announced again.
import { readonly, ref } from 'vue'

const polite = ref('')
const assertive = ref('')
const timers: Partial<Record<'polite' | 'assertive', ReturnType<typeof setTimeout>>> = {}

export const liveMessages = { polite: readonly(polite), assertive: readonly(assertive) }

export function announce(message: string, options: { assertive?: boolean } = {}): void {
  const kind = options.assertive ? 'assertive' : 'polite'
  const region = kind === 'assertive' ? assertive : polite
  region.value = ''
  if (timers[kind]) clearTimeout(timers[kind])
  timers[kind] = setTimeout(() => {
    region.value = message
  }, 50)
}

export function useAnnouncer() {
  return { announce }
}

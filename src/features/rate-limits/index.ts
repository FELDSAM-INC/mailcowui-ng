// UI feature 006, the rate limit area (research R4): the rate limit sections of the domain, alias
// domain and mailbox pages, the Rate limits overview and the bucket reset, whose dialog UI 011
// reuses on its rate-limited log. It imports the quarantine area through its index only. The
// section is an async component loaded with the 006 strings (the pattern of `@/features/dns`), so
// the host pages' chunks do not grow with rate limit code.
import { defineAsyncComponent } from 'vue'

import { loadFeatureMessages } from '@/i18n'

export { rateLimitRoutes } from './routes'

function withMessages<T>(load: () => Promise<T>) {
  return () => Promise.all([load(), loadFeatureMessages('quarantine')]).then(([module]) => module)
}

/**
 * The rate limit section of a domain, alias domain or mailbox page (props `kind`: `domain`,
 * `aliasDomain` or `mailbox`, and `object`: the ASCII domain name, alias domain name or mailbox
 * address). Its root carries `id="rate-limit"`, so `#rate-limit` opens the page at it.
 */
export const RateLimitSection = defineAsyncComponent(
  withMessages(() => import('./components/RateLimitSection.vue')),
)

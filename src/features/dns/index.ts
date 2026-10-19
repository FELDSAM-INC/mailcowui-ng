// UI feature 010, DKIM, MTA-STS and DNS diagnostics (research R2, R19). Other code reaches it only
// through this file: the routes, and the components that the domain page (UI 002) and the alias
// domain pages (UI 004) mount in their action areas. The sections are async components, loaded
// with the DNS strings, so the domain page's chunk does not grow with DNS code.
import { defineAsyncComponent } from 'vue'

import { loadFeatureMessages } from '@/i18n'

export { dnsRoutes } from './routes'

function withMessages<T>(load: () => Promise<T>) {
  return () => Promise.all([load(), loadFeatureMessages('dns')]).then(([module]) => module)
}

/** The DKIM section of a domain or alias domain page (props `name`, `kind`). */
export const DomainDkimSection = defineAsyncComponent(
  withMessages(() => import('./components/DomainDkimSection.vue')),
)

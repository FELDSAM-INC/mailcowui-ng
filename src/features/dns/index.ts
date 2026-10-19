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

/**
 * "DNS": the diagnostics of a name, as a menu item or a button (props `name`, `variant`). Lazy, so
 * that the router's import of this file keeps the menu primitives out of the initial bundle; its
 * label is a main string, so it needs no feature strings.
 */
export const CheckDnsAction = defineAsyncComponent(() => import('./components/CheckDnsAction.vue'))

/** The DKIM section of a domain or alias domain page (props `name`, `kind`). */
export const DomainDkimSection = defineAsyncComponent(
  withMessages(() => import('./components/DomainDkimSection.vue')),
)

/** The MTA-STS section of the domain page (prop `domain`), at the place of legacy's tab. */
export const DomainMtaStsSection = defineAsyncComponent(
  withMessages(() => import('./components/DomainMtaStsSection.vue')),
)

/** The MTA-STS section of an alias domain page (props `aliasDomain`, `targetDomain`). */
export const AliasDomainMtaStsSection = defineAsyncComponent(
  withMessages(() => import('./components/AliasDomainMtaStsSection.vue')),
)

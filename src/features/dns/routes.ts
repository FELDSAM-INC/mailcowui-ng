// The routes of UI 010 (data-model §5, research R2). Every page is lazy-loaded together with the
// feature's own strings (`loadFeatureMessages`), which the shell does not bundle. The stories add
// their pages; until then the catalogue's placeholders answer at the section roots.
import type { RouteRecordRaw } from 'vue-router'

export const dnsRoutes: RouteRecordRaw[] = [
  { path: '/dns', name: 'dns', redirect: '/dns/dkim-keys' },
]

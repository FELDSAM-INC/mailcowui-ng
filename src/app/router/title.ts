// The document title "{page} – {pageTitle}" (FR-049, research R16), set after every navigation
// and again when the language or the configured page title changes.
import { watch, type WatchSource } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'

import { resolveText } from '@/i18n'

export interface TitleSources {
  t: (key: string, named?: Record<string, unknown>) => string
  /** The configured page title (`PublicConfig.pageTitle`, or the FR-003 default). */
  pageTitle: () => string
  /** Changes that must recompute the title: the language and the configuration. */
  dependencies: WatchSource[]
  actingUsername?: () => string | undefined
}

export function documentTitle(route: RouteLocationNormalizedLoaded, sources: TitleSources) {
  const site = sources.pageTitle()
  const ref = route.meta.titleKey
  const title = ref
    ? sources.t('common.documentTitle', { page: resolveText(ref, (key) => sources.t(key)), site })
    : site
  const username = sources.actingUsername?.()
  return username ? sources.t('acting.titlePrefix', { username }) + title : title
}

export function installTitle(router: Router, sources: TitleSources): () => void {
  const apply = () => {
    document.title = documentTitle(router.currentRoute.value, sources)
  }
  router.afterEach((_to, _from, failure) => {
    if (!failure) apply()
  })
  return watch([...sources.dependencies, () => router.currentRoute.value], apply, {
    immediate: true,
  })
}

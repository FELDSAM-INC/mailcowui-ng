import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'

/** A direct visit has a safe parent; a return to that list keeps its query and scroll anchor. */
export function detailBackTo(route: RouteLocationNormalizedLoaded, router: Router): string | null {
  const name = String(route.name ?? '')
  if (name === 'operations-log' || name === 'not-found') return null
  const record = route.matched.at(-1)
  if (!record || (!record.path.includes(':') && !name.endsWith('-create'))) return null

  const fallback: Record<string, string> = {
    'operations-container': '/operations/dashboard',
    'dns-diagnostics': '/dns/dkim-keys',
  }
  let parent = fallback[name]
  if (!parent) {
    const segments = route.path.split('/')
    while (segments.length > 1) {
      segments.pop()
      const path = segments.join('/') || '/'
      const resolved = router.resolve(path)
      if (
        resolved.matched.length &&
        !resolved.matched.some((item) => item.path.includes(':pathMatch')) &&
        resolved.name !== route.name
      ) {
        parent = path
        break
      }
    }
  }
  if (!parent) return null
  const previous = router.options.history.state.back
  if (typeof previous === 'string' && previous.startsWith('/') && !previous.startsWith('//')) {
    const resolved = router.resolve(previous)
    if (resolved.path === parent) return resolved.fullPath
  }
  return parent
}

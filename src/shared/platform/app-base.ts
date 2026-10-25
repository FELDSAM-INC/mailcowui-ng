// The deployment bootstrap is a same-origin static file. Assets stay under /ng/;
// the operator can serve browser routes at either /ng/ or / without rebuilding.
type BaseConfiguration = Pick<Window, '__MAILCOW_UI_BASE_PATH__'>

interface LocationWindow extends BaseConfiguration {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>
  history: Pick<History, 'state' | 'replaceState'>
}

declare global {
  interface Window {
    __MAILCOW_UI_BASE_PATH__?: unknown
  }
}

export function appBasePath(target: BaseConfiguration = window): string {
  const configured = target.__MAILCOW_UI_BASE_PATH__
  return configured === '/' || configured === '/ng/' ? configured : import.meta.env.BASE_URL
}

/** Retain old bookmarks and provider callbacks without redirecting credentials over HTTP. */
export function normalizeAppLocation(target: LocationWindow = window): void {
  const { pathname, search, hash } = target.location
  if (appBasePath(target) !== '/' || (pathname !== '/ng' && !pathname.startsWith('/ng/'))) return
  const path = pathname.slice(3) || '/'
  if (path.startsWith('//') || path.includes('\\')) return
  target.history.replaceState(target.history.state, '', `${path}${search}${hash}`)
}

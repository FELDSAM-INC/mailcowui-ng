/** Single-use in-memory OAuth parameters, removed before bootstrap requests or navigation. */
export interface CapturedOAuthReturn {
  code?: string
  state?: string
  error?: string
}
export interface ReturnWindow {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>
  history: Pick<History, 'state' | 'replaceState'>
}
export function createOAuthReturnCapture(path: RegExp) {
  let captured: CapturedOAuthReturn | null = null
  return {
    capture: (target: ReturnWindow = window): void => {
      const { location, history } = target
      if (!path.test(location.pathname)) return
      const query = new URLSearchParams(location.search)
      const values: CapturedOAuthReturn = {}
      for (const name of ['code', 'state', 'error'] as const) {
        const value = query.get(name)
        if (value !== null) values[name] = value
      }
      captured = values
      if (location.search || location.hash)
        history.replaceState(history.state, '', location.pathname)
    },
    take: (): CapturedOAuthReturn | null => {
      const value = captured
      captured = null
      return value
    },
  }
}

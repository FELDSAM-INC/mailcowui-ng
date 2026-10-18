// The single sign-on return parameters, captured before anything else (UI 012 research R5,
// FR-046). `src/main.ts` calls `captureSingleSignOnReturn()` as its first statement, before the
// router and the bootstrap send any request: on the return page it reads the first `code`, `state`
// and `error` of the query into memory, drops every other parameter unread (`error_description`,
// `session_state`, …), and replaces the address with the bare path, keeping the history state, so
// that no later request carries them in its `Referer` and the history entry no longer holds them.
// `takeCapturedSingleSignOnReturn()` hands the values over once. Nothing is ever stored.

export interface CapturedReturn {
  code?: string
  state?: string
  error?: string
}

/** The app's return page, the address the API registers at the provider (FR-045). */
export const SSO_RETURN_PATH = `${import.meta.env.BASE_URL}sso/return`

interface ReturnWindow {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>
  history: Pick<History, 'state' | 'replaceState'>
}

let captured: CapturedReturn | null = null

export function captureSingleSignOnReturn(target: ReturnWindow = window): void {
  const { location, history } = target
  if (location.pathname !== SSO_RETURN_PATH && location.pathname !== `${SSO_RETURN_PATH}/`) return
  const query = new URLSearchParams(location.search)
  const values: CapturedReturn = {}
  for (const name of ['code', 'state', 'error'] as const) {
    const value = query.get(name)
    if (value !== null) values[name] = value
  }
  captured = values
  if (location.search || location.hash) history.replaceState(history.state, '', location.pathname)
}

/** The captured values, once; null when the page was not opened as a return. */
export function takeCapturedSingleSignOnReturn(): CapturedReturn | null {
  const value = captured
  captured = null
  return value
}

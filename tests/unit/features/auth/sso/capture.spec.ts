// T046: the return parameters are captured and stripped before anything else (research R5,
// FR-046): only on the return page, the first code, state and error, everything else dropped, the
// address replaced by the bare path with the history state kept, and taken once.
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  captureSingleSignOnReturn,
  SSO_RETURN_PATH,
  takeCapturedSingleSignOnReturn,
} from '@/features/auth/sso/capture'

function fakeWindow(pathname: string, search = '', hash = '') {
  const state = { back: null, position: 3 }
  return {
    location: { pathname, search, hash },
    history: { state, replaceState: vi.fn() },
  }
}

afterEach(() => {
  takeCapturedSingleSignOnReturn()
})

describe('captureSingleSignOnReturn', () => {
  it('is the return path under the app base (`/ng/sso/return` in the build)', () => {
    expect(SSO_RETURN_PATH).toBe(`${import.meta.env.BASE_URL}sso/return`)
  })

  it('reads the first code, state and error and strips the address with the state kept', () => {
    const win = fakeWindow(
      SSO_RETURN_PATH,
      '?code=one&state=s1&code=two&error_description=Denied%20by%20you&session_state=x&iss=y',
      '#frag',
    )
    captureSingleSignOnReturn(win)
    expect(win.history.replaceState).toHaveBeenCalledWith(win.history.state, '', SSO_RETURN_PATH)
    expect(takeCapturedSingleSignOnReturn()).toEqual({ code: 'one', state: 's1' })
  })

  it('captures the provider error without its description', () => {
    captureSingleSignOnReturn(
      fakeWindow(SSO_RETURN_PATH, '?error=access_denied&error_description=No&state=s'),
    )
    expect(takeCapturedSingleSignOnReturn()).toEqual({ error: 'access_denied', state: 's' })
  })

  it('returns the values once', () => {
    captureSingleSignOnReturn(fakeWindow(SSO_RETURN_PATH, '?code=c&state=s'))
    expect(takeCapturedSingleSignOnReturn()).not.toBeNull()
    expect(takeCapturedSingleSignOnReturn()).toBeNull()
  })

  it('captures an empty return without touching the address', () => {
    const win = fakeWindow(SSO_RETURN_PATH)
    captureSingleSignOnReturn(win)
    expect(win.history.replaceState).not.toHaveBeenCalled()
    expect(takeCapturedSingleSignOnReturn()).toEqual({})
  })

  it('does nothing on any other page', () => {
    const base = import.meta.env.BASE_URL
    for (const path of [base, `${base}sign-in`, `${SSO_RETURN_PATH}ed`, '/elsewhere/sso/return']) {
      const win = fakeWindow(path, '?code=c&state=s')
      captureSingleSignOnReturn(win)
      expect(win.history.replaceState).not.toHaveBeenCalled()
      expect(takeCapturedSingleSignOnReturn()).toBeNull()
    }
  })

  it('accepts the return path with a trailing slash', () => {
    const win = fakeWindow(`${SSO_RETURN_PATH}/`, '?code=c&state=s')
    captureSingleSignOnReturn(win)
    expect(win.history.replaceState).toHaveBeenCalledWith(
      win.history.state,
      '',
      `${SSO_RETURN_PATH}/`,
    )
    expect(takeCapturedSingleSignOnReturn()).toEqual({ code: 'c', state: 's' })
  })
})

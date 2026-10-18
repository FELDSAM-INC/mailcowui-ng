// T046: the requested in-app address kept for one single sign-on round trip (research R4, FR-043,
// FR-047): written only when the router accepts it, read and removed once, and a throwing storage
// never breaks the round trip.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { forgetKeptReturnTo, keepReturnTo, takeKeptReturnTo } from '@/features/auth/sso/return-to'

import { createTestRouter } from '../../../support/router'

const KEY = 'mailcowui-ng.sso-return-to'

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('kept return address', () => {
  it('keeps an accepted in-app path and returns it once', () => {
    const router = createTestRouter()
    keepReturnTo('/domains?page=2', router)
    expect(sessionStorage.getItem(KEY)).toBe('/domains?page=2')
    expect(takeKeptReturnTo(router)).toBe('/domains?page=2')
    expect(sessionStorage.getItem(KEY)).toBeNull()
    expect(takeKeptReturnTo(router)).toBeNull()
  })

  it('removes the key for a value the router refuses', () => {
    const router = createTestRouter()
    sessionStorage.setItem(KEY, '/domains')
    for (const value of ['https://evil.example/', '//evil.example', '/sign-in', null, 42]) {
      keepReturnTo(value, router)
      expect(sessionStorage.getItem(KEY)).toBeNull()
    }
  })

  it('never returns a stored value the router refuses', () => {
    const router = createTestRouter()
    sessionStorage.setItem(KEY, '//evil.example')
    expect(takeKeptReturnTo(router)).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('forgets a value left behind', () => {
    sessionStorage.setItem(KEY, '/domains')
    forgetKeptReturnTo()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('yields null when the storage throws', () => {
    const router = createTestRouter()
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(() => keepReturnTo('/domains', router)).not.toThrow()
    expect(takeKeptReturnTo(router)).toBeNull()
    expect(() => forgetKeptReturnTo()).not.toThrow()
  })
})

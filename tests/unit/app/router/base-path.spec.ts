import { describe, expect, it, vi } from 'vitest'

import { appBasePath, normalizeAppLocation } from '@/shared/platform/app-base'
import { buildRoutes } from '@/app/router/routes'
import deployment from '../../../../public/deployment.json'

function fakeWindow(pathname: string, base: unknown = '/') {
  return {
    __MAILCOW_UI_BASE_PATH__: base,
    location: { pathname, search: '?token=secret%2Bvalue', hash: '#section' },
    history: { state: { position: 3 }, replaceState: vi.fn() },
  }
}

describe('deployment base path', () => {
  it('advertises every concrete route root to the deployment tool', () => {
    const roots = [...new Set(buildRoutes().map((route) => route.path.split('/')[1]))]
      .filter((root): root is string => !!root && !root.startsWith(':'))
      .sort()
    expect(deployment.routeRoots).toEqual(roots)
  })
  it('accepts only the two supported same-origin bases', () => {
    expect(appBasePath(fakeWindow('/', '/'))).toBe('/')
    expect(appBasePath(fakeWindow('/ng/', '/ng/'))).toBe('/ng/')
    for (const base of [undefined, '//evil.example/', 'https://evil.example/', '/elsewhere/']) {
      expect(appBasePath(fakeWindow('/', base))).toBe(import.meta.env.BASE_URL)
    }
  })

  it.each(['/ng/', '/ng', '/ng/sso/return', '/ng/mailboxes/alice%40example.org'])(
    'moves an old %s bookmark into root mode without a request',
    (path) => {
      const target = fakeWindow(path)
      normalizeAppLocation(target)
      expect(target.history.replaceState).toHaveBeenCalledWith(
        target.history.state,
        '',
        `${path.slice(3) || '/'}?token=secret%2Bvalue#section`,
      )
    },
  )

  it('leaves root routes, unrelated prefixes, and subpath mode alone', () => {
    for (const target of [
      fakeWindow('/mailboxes'),
      fakeWindow('/nginx/'),
      fakeWindow('/ng/mailboxes', '/ng/'),
    ]) {
      normalizeAppLocation(target)
      expect(target.history.replaceState).not.toHaveBeenCalled()
    }
  })

  it.each(['/ng//evil.example/path', '/ng/\\evil.example/path'])('rejects unsafe %s', (path) => {
    const target = fakeWindow(path)
    normalizeAppLocation(target)
    expect(target.history.replaceState).not.toHaveBeenCalled()
  })
})

// Device storage holds only the conveniences of data-model §4 (FR-091), and a throwing or missing
// storage never breaks the caller (edge case "storage disabled").
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ALLOWED_LOCAL_KEYS,
  ALLOWED_SESSION_KEYS,
  localStore,
  sessionStore,
  type LocalStorageKey,
  type SessionStorageKey,
} from '@/shared/platform/storage'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe('allowlist (data-model §4)', () => {
  it('lists exactly the documented keys', () => {
    expect([...ALLOWED_LOCAL_KEYS].sort()).toEqual([
      'mailcowui-ng.locale',
      'mailcowui-ng.passkey-suggestion-dismissed',
      'mailcowui-ng.theme',
    ])
    expect([...ALLOWED_SESSION_KEYS]).toEqual(['mailcowui-ng.announcement-collapsed'])
  })

  it('writes, reads and removes an allowed localStorage key', () => {
    expect(localStore.set('mailcowui-ng.theme', 'dark')).toBe(true)
    expect(localStorage.getItem('mailcowui-ng.theme')).toBe('dark')
    expect(localStore.get('mailcowui-ng.theme')).toBe('dark')
    localStore.remove('mailcowui-ng.theme')
    expect(localStore.get('mailcowui-ng.theme')).toBeNull()
  })

  it('writes and reads the allowed sessionStorage key', () => {
    expect(sessionStore.set('mailcowui-ng.announcement-collapsed', 'abc')).toBe(true)
    expect(sessionStorage.getItem('mailcowui-ng.announcement-collapsed')).toBe('abc')
    expect(sessionStore.get('mailcowui-ng.announcement-collapsed')).toBe('abc')
    sessionStore.remove('mailcowui-ng.announcement-collapsed')
    expect(sessionStorage.length).toBe(0)
  })

  it('refuses any other key at runtime and writes nothing', () => {
    expect(localStore.set('mailcowui-ng.username' as LocalStorageKey, 'alice')).toBe(false)
    expect(localStore.set('csrf-token' as LocalStorageKey, 'x')).toBe(false)
    expect(sessionStore.set('mailcowui-ng.theme' as SessionStorageKey, 'dark')).toBe(false)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('does not read or remove keys outside the allowlist', () => {
    localStorage.setItem('other', 'value')
    expect(localStore.get('other' as LocalStorageKey)).toBeNull()
    localStore.remove('other' as LocalStorageKey)
    expect(localStorage.getItem('other')).toBe('value')
  })

  it('keeps the two storages apart', () => {
    expect(localStore.set('mailcowui-ng.announcement-collapsed' as LocalStorageKey, 'x')).toBe(
      false,
    )
    expect(sessionStore.get('mailcowui-ng.locale' as SessionStorageKey)).toBeNull()
  })
})

describe('storage disabled', () => {
  function throwingStorage(): Storage {
    const fail = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    return {
      get length(): number {
        return fail()
      },
      clear: fail,
      getItem: fail,
      key: fail,
      removeItem: fail,
      setItem: fail,
    }
  }

  it('never throws when every storage call throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(throwingStorage())
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(throwingStorage())
    expect(localStore.set('mailcowui-ng.locale', 'cs-cz')).toBe(false)
    expect(localStore.get('mailcowui-ng.locale')).toBeNull()
    expect(() => localStore.remove('mailcowui-ng.locale')).not.toThrow()
    expect(sessionStore.set('mailcowui-ng.announcement-collapsed', 'x')).toBe(false)
    expect(sessionStore.get('mailcowui-ng.announcement-collapsed')).toBeNull()
    expect(() => sessionStore.remove('mailcowui-ng.announcement-collapsed')).not.toThrow()
  })

  it('never throws when accessing the storage object itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })
    expect(localStore.set('mailcowui-ng.theme', 'light')).toBe(false)
    expect(localStore.get('mailcowui-ng.theme')).toBeNull()
    expect(() => localStore.remove('mailcowui-ng.theme')).not.toThrow()
  })

  it('never throws when the quota is exceeded', () => {
    const quota = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    expect(localStore.set('mailcowui-ng.theme', 'dark')).toBe(false)
    quota.mockRestore()
  })
})

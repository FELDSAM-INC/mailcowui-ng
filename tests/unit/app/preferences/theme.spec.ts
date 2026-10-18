// Theme preference (FR-059, FR-062, research R16): light, dark or the device setting, applied to
// <html> as the `.dark` class and `color-scheme`, remembered on the device.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { applyTheme, resolveDark, stopFollowingSystem } from '@/app/preferences/theme'

import { installMatchMedia } from '../../support/media'

const DARK = '(prefers-color-scheme: dark)'
const root = () => document.documentElement

beforeEach(() => {
  root().classList.remove('dark')
  root().style.colorScheme = ''
})

afterEach(() => {
  stopFollowingSystem()
})

describe('theme', () => {
  it('applies dark and light explicitly', () => {
    installMatchMedia({ [DARK]: true })
    applyTheme('light')
    expect(root().classList.contains('dark')).toBe(false)
    expect(root().style.colorScheme).toBe('light')
    applyTheme('dark')
    expect(root().classList.contains('dark')).toBe(true)
    expect(root().style.colorScheme).toBe('dark')
  })

  it('follows the device setting without a reload (FR-062)', () => {
    const media = installMatchMedia({ [DARK]: false })
    applyTheme('system')
    expect(root().classList.contains('dark')).toBe(false)
    media.set(DARK, true)
    expect(root().classList.contains('dark')).toBe(true)
    expect(root().style.colorScheme).toBe('dark')
    media.set(DARK, false)
    expect(root().classList.contains('dark')).toBe(false)
    expect(root().style.colorScheme).toBe('light')
  })

  it('stops following the device after an explicit choice', () => {
    const media = installMatchMedia({ [DARK]: false })
    applyTheme('system')
    applyTheme('light')
    media.set(DARK, true)
    expect(root().classList.contains('dark')).toBe(false)
  })

  it('remembers the theme on the device for theme-init.js', () => {
    installMatchMedia()
    applyTheme('dark')
    expect(localStorage.getItem('mailcowui-ng.theme')).toBe('dark')
    applyTheme('system')
    expect(localStorage.getItem('mailcowui-ng.theme')).toBe('system')
  })

  it('works without matchMedia (light)', () => {
    expect(resolveDark('system', undefined)).toBe(false)
    expect(resolveDark('dark', undefined)).toBe(true)
  })
})

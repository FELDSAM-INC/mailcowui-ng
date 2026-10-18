// Theme preference (FR-059, FR-062, research R16). The theme is applied to <html> as the `.dark`
// class (Tailwind's dark variant) and `color-scheme` (native controls), and remembered on the
// device, where public/theme-init.js reads it before the first paint. `system` follows the device
// setting through a matchMedia listener, without a reload.
import type { Theme } from '@/api'
import { localStore } from '@/shared/platform/storage'

const DARK_QUERY = '(prefers-color-scheme: dark)'

type MatchMedia = (query: string) => MediaQueryList

let following: { list: MediaQueryList; listener: () => void } | null = null

function deviceMatchMedia(): MatchMedia | undefined {
  return typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined
}

/** Whether a theme shows dark, given the device setting. */
export function resolveDark(theme: Theme, matchMedia: MatchMedia | undefined): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return matchMedia?.(DARK_QUERY).matches ?? false
}

function paint(dark: boolean): void {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  // CSSOM, which the strict CSP allows.
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function stopFollowingSystem(): void {
  if (!following) return
  following.list.removeEventListener('change', following.listener)
  following = null
}

export function applyTheme(theme: Theme): void {
  stopFollowingSystem()
  const matchMedia = deviceMatchMedia()
  paint(resolveDark(theme, matchMedia))
  if (theme === 'system' && matchMedia) {
    const list = matchMedia(DARK_QUERY)
    const listener = () => paint(list.matches)
    list.addEventListener('change', listener)
    following = { list, listener }
  }
  localStore.set('mailcowui-ng.theme', theme)
}

/** The theme remembered on this device, if valid. */
export function rememberedTheme(): Theme | null {
  const value = localStore.get('mailcowui-ng.theme')
  return value === 'light' || value === 'dark' || value === 'system' ? value : null
}

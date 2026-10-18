// The app's translations (constitution IV 1.3.0, research R15), in two parts:
// - mailcow's own strings, loaded at runtime from the installation (`./legacy`, `lt()`,
//   `<LegacyText>`), never compiled by vue-i18n;
// - the app's new strings, in vue-i18n (Composition API mode, runtime-only, messages precompiled
//   by @intlify/unplugin-vue-i18n: no runtime compilation, CSP). en-gb is bundled; cs-cz and sk-sk
//   are lazy chunks; every other locale falls back to en-gb.
import { createI18n } from 'vue-i18n'

import { lt } from './legacy'
import { LEGACY_TEXTS } from './legacy-messages'
import { DEFAULT_LOCALE, type AppLocale } from './locales'
import enGb from './messages/en-gb.json'

export type MessageSchema = typeof enGb

declare module 'vue-i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}

export function createAppI18n() {
  return createI18n({
    legacy: false,
    globalInjection: false,
    locale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    missingWarn: false,
    fallbackWarn: false,
    messages: { [DEFAULT_LOCALE]: enGb },
  })
}

export type AppI18n = ReturnType<typeof createAppI18n>

const loaders: Partial<Record<AppLocale, () => Promise<MessageSchema>>> = {
  'cs-cz': () => import('./messages/cs-cz.json').then((m) => m.default),
  'sk-sk': () => import('./messages/sk-sk.json').then((m) => m.default),
}

/**
 * Loads a locale's new strings into an i18n instance (once), if it has its own; the others use
 * en-gb. Does not switch to it.
 */
export async function loadLocale(target: AppI18n, locale: AppLocale): Promise<void> {
  const loader = loaders[locale]
  if (!loader || target.global.availableLocales.includes(locale)) return
  target.global.setLocaleMessage(locale, await loader())
}

/** The app's single i18n instance. */
export const i18n = createAppI18n()

/**
 * Whether a key built at runtime has a text: a new string (en-gb is complete and cs-cz and sk-sk
 * have the same keys, `npm run i18n:check`, so en-gb answers for every locale), or mailcow's own
 * text through `LEGACY_TEXTS`.
 */
export function hasMessage(key: string): boolean {
  return key in LEGACY_TEXTS || i18n.global.te(key, DEFAULT_LOCALE)
}

/**
 * The text of a key built at runtime (`roles.${role}`, `problem.${name}`): mailcow's own text when
 * `LEGACY_TEXTS` names one, otherwise the new string. Reactive like `t`.
 */
export function text(key: string, named?: Record<string, unknown>): string {
  const classic = LEGACY_TEXTS[key]
  if (classic) return lt(classic)
  return named ? i18n.global.t(key, named) : i18n.global.t(key)
}

export { hasLegacy, legacyStatus, loadLegacy, lt, prefetchLegacy, type LegacyKey } from './legacy'
export type { LegacyArg, LegacyNamed } from './legacy-format'
export { legacy, resolveText, type LegacyRef, type TextRef } from './text'

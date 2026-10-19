// The app's translations (constitution IV 1.3.0, research R15), in two parts:
// - mailcow's own strings, loaded at runtime from the installation (`./legacy`, `lt()`,
//   `<LegacyText>`), never compiled by vue-i18n;
// - the app's new strings, in vue-i18n (Composition API mode, runtime-only, messages precompiled
//   by @intlify/unplugin-vue-i18n: no runtime compilation, CSP). en-gb is bundled; cs-cz and sk-sk
//   are lazy chunks; every other locale falls back to en-gb. A feature's own strings
//   (`messages/<feature>/<locale>.json`) are lazy chunks loaded with its routes
//   (`loadFeatureMessages`), so that the shell does not carry them (constitution VII).
import { createI18n } from 'vue-i18n'

import { legacyRaw, lt } from './legacy'
import { formatLegacy, type LegacyArg } from './legacy-format'
import { LEGACY_ARGS, LEGACY_TEXTS } from './legacy-messages'
import { DEFAULT_LOCALE, type AppLocale } from './locales'
import type enGbDomains from './messages/domains/en-gb.json'
import enGb from './messages/en-gb.json'

export type MessageSchema = typeof enGb & typeof enGbDomains

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
    // The features' strings are merged in when their routes load (`loadFeatureMessages`).
    // A copy, so that merging them never changes the imported module (one instance per test).
    messages: { [DEFAULT_LOCALE]: structuredClone(enGb) as MessageSchema },
  })
}

export type AppI18n = ReturnType<typeof createAppI18n>

type Messages = Record<string, unknown>
type Loader = () => Promise<Messages>

const loaders: Partial<Record<AppLocale, Loader>> = {
  'cs-cz': () => import('./messages/cs-cz.json').then((m) => m.default),
  'sk-sk': () => import('./messages/sk-sk.json').then((m) => m.default),
}

/** The strings of features, loaded with their routes; en-gb is their fallback. */
const featureLoaders = {
  domains: {
    'en-gb': () => import('./messages/domains/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/domains/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/domains/sk-sk.json').then((m) => m.default),
  },
} satisfies Record<string, Partial<Record<AppLocale, Loader>>>

export type MessageFeature = keyof typeof featureLoaders

/** What each i18n instance holds: the locales of the app's strings, and of each feature's. */
const loaded = new WeakMap<object, { app: Set<string>; features: Map<string, Set<string>> }>()

function holdings(target: AppI18n) {
  let entry = loaded.get(target)
  if (!entry) {
    entry = { app: new Set([DEFAULT_LOCALE]), features: new Map() }
    loaded.set(target, entry)
  }
  return entry
}

async function mergeOnce(target: AppI18n, done: Set<string>, locale: string, loader?: Loader) {
  if (!loader || done.has(locale)) return
  const messages = await loader()
  if (done.has(locale)) return
  target.global.mergeLocaleMessage(locale, messages)
  done.add(locale)
}

/**
 * Loads a feature's strings into an i18n instance (once per locale): en-gb, and the locale in use
 * when the feature has it. Later language changes load it with the app's strings (`loadLocale`).
 */
export async function loadFeatureMessages(
  feature: MessageFeature,
  target: AppI18n = i18n,
  locale: string = target.global.locale.value,
): Promise<void> {
  const { features } = holdings(target)
  let done = features.get(feature)
  if (!done) {
    done = new Set()
    features.set(feature, done)
  }
  const sets: Partial<Record<string, Loader>> = featureLoaders[feature]
  await Promise.all([
    mergeOnce(target, done, DEFAULT_LOCALE, sets[DEFAULT_LOCALE]),
    locale === DEFAULT_LOCALE ? undefined : mergeOnce(target, done, locale, sets[locale]),
  ])
}

/**
 * Loads a locale's new strings into an i18n instance (once), if it has its own, with those of the
 * features already loaded; the others use en-gb. Does not switch to it.
 */
export async function loadLocale(target: AppI18n, locale: AppLocale): Promise<void> {
  const { app, features } = holdings(target)
  await Promise.all([
    mergeOnce(target, app, locale, loaders[locale]),
    ...[...features.keys()].map((feature) =>
      loadFeatureMessages(feature as MessageFeature, target, locale),
    ),
  ])
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
  if (classic) {
    // UI 004: placeholders filled in order from the named parameters; a missing one stays as the
    // file has it.
    const names = LEGACY_ARGS[key]
    if (!names) return lt(classic)
    const args = names.map((name) => named?.[name]) as LegacyArg[]
    return formatLegacy(legacyRaw(classic), args)
  }
  return named ? i18n.global.t(key, named) : i18n.global.t(key)
}

export { hasLegacy, legacyStatus, loadLegacy, lt, prefetchLegacy, type LegacyKey } from './legacy'
export type { LegacyArg, LegacyNamed } from './legacy-format'
export { legacy, resolveText, type LegacyRef, type TextRef } from './text'

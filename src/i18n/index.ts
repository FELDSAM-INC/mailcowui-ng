// The app's vue-i18n setup (research R15): Composition API mode, runtime-only, with messages
// precompiled by @intlify/unplugin-vue-i18n (no runtime compilation, CSP). Each locale has two
// layers: the legacy layer generated from mailcow's translations and the hand-written app layer.
// en-gb is bundled as the fallback; cs-cz and sk-sk are lazy chunks loaded before they are
// applied.
import { createI18n } from 'vue-i18n'

import enGbLegacy from './legacy/en-gb.json'
import { DEFAULT_LOCALE, type AppLocale } from './locales'
import enGbApp from './messages/en-gb.json'

export type MessageSchema = typeof enGbApp & typeof enGbLegacy

declare module 'vue-i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}

type Tree = Record<string, unknown>

/** A compiled message (vue-i18n AST: type 0 with a body), as opposed to a namespace. */
function isMessageAst(value: Tree): boolean {
  return (value.t ?? value.type) === 0 && ('b' in value || 'body' in value)
}

const isTree = (value: unknown): value is Tree =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !isMessageAst(value as Tree)

/** Merges the two layers; they never share a key (checked by `npm run i18n:check`). */
export function mergeLayers(legacy: Tree, app: Tree): Tree {
  const out: Tree = { ...legacy }
  for (const [key, value] of Object.entries(app)) {
    const existing = out[key]
    out[key] = isTree(existing) && isTree(value) ? mergeLayers(existing, value) : value
  }
  return out
}

export function createAppI18n() {
  return createI18n({
    legacy: false,
    globalInjection: false,
    locale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    missingWarn: false,
    fallbackWarn: false,
    messages: { [DEFAULT_LOCALE]: mergeLayers(enGbLegacy, enGbApp) as MessageSchema },
  })
}

export type AppI18n = ReturnType<typeof createAppI18n>

const loaders: Record<Exclude<AppLocale, 'en-gb'>, () => Promise<[Tree, Tree]>> = {
  'cs-cz': () =>
    Promise.all([
      import('./legacy/cs-cz.json').then((m) => m.default as Tree),
      import('./messages/cs-cz.json').then((m) => m.default as Tree),
    ]),
  'sk-sk': () =>
    Promise.all([
      import('./legacy/sk-sk.json').then((m) => m.default as Tree),
      import('./messages/sk-sk.json').then((m) => m.default as Tree),
    ]),
}

/** Loads a locale's messages into an i18n instance (once). Does not switch to it. */
export async function loadLocale(target: AppI18n, locale: AppLocale): Promise<void> {
  if (locale === 'en-gb' || target.global.availableLocales.includes(locale)) return
  const [legacy, app] = await loaders[locale]()
  target.global.setLocaleMessage(locale, mergeLayers(legacy, app) as MessageSchema)
}

/** The app's single i18n instance. */
export const i18n = createAppI18n()

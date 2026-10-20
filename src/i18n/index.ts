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
import type enGbAdministrators from './messages/administrators/en-gb.json'
import type enGbAccount from './messages/account/en-gb.json'
import type enGbAliases from './messages/aliases/en-gb.json'
import type enGbDnsDiagnostics from './messages/dns-diagnostics/en-gb.json'
import type enGbDnsMtaSts from './messages/dns-mta-sts/en-gb.json'
import type enGbDns from './messages/dns/en-gb.json'
import type enGbDomains from './messages/domains/en-gb.json'
import enGb from './messages/en-gb.json'
import type enGbIdentityProviders from './messages/identity-providers/en-gb.json'
import type enGbMailboxes from './messages/mailboxes/en-gb.json'
import type enGbRouting from './messages/routing/en-gb.json'
import type enGbOperationsFail2ban from './messages/operations-fail2ban/en-gb.json'
import type enGbOperationsLogs from './messages/operations-logs/en-gb.json'
import type enGbOperationsQueue from './messages/operations-queue/en-gb.json'
import type enGbOperations from './messages/operations/en-gb.json'
import type enGbQuarantineAdmin from './messages/quarantine-admin/en-gb.json'
import type enGbQuarantine from './messages/quarantine/en-gb.json'
import type enGbRateLimits from './messages/rate-limits/en-gb.json'
import type enGbSpamFilter from './messages/spam-filter/en-gb.json'
import type enGbSyncJobs from './messages/sync-jobs/en-gb.json'

export type MessageSchema = typeof enGb &
  typeof enGbAdministrators &
  typeof enGbAccount &
  typeof enGbDomains &
  typeof enGbMailboxes &
  typeof enGbSyncJobs &
  typeof enGbIdentityProviders &
  typeof enGbAliases &
  typeof enGbDns &
  typeof enGbDnsDiagnostics &
  typeof enGbDnsMtaSts &
  typeof enGbRouting &
  typeof enGbOperations &
  typeof enGbOperationsLogs &
  typeof enGbOperationsQueue &
  typeof enGbOperationsFail2ban &
  typeof enGbQuarantine &
  typeof enGbQuarantineAdmin &
  typeof enGbSpamFilter &
  typeof enGbRateLimits

declare module 'vue-i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}

/**
 * Czech and Slovak plural forms of the app's new strings (UI 005 research R23, FR-119): the first
 * form for 1, the second for 2 to 4, the third for 0 and 5 or more. Messages with fewer forms
 * choose "one" or "other". `npm run i18n:check` requires three forms in cs-cz and sk-sk.
 */
export function slavicPlural(choice: number, choicesLength: number): number {
  const n = Math.abs(choice)
  if (choicesLength < 2) return 0
  if (n === 1) return 0
  if (choicesLength === 2) return 1
  return n >= 2 && n <= 4 ? 1 : 2
}

export function createAppI18n() {
  return createI18n({
    legacy: false,
    globalInjection: false,
    locale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    missingWarn: false,
    fallbackWarn: false,
    pluralRules: { 'cs-cz': slavicPlural, 'sk-sk': slavicPlural },
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

/** Merges message modules group by group (a feature whose strings are split over files). */
async function mergeAll(modules: Promise<{ default: Messages }>[]): Promise<Messages> {
  const merge = (target: Messages, source: Messages): Messages => {
    for (const [key, value] of Object.entries(source)) {
      const current = target[key]
      target[key] =
        current && typeof current === 'object' && value && typeof value === 'object'
          ? merge({ ...(current as Messages) }, value as Messages)
          : value
    }
    return target
  }
  return (await Promise.all(modules)).reduce<Messages>((all, m) => merge(all, m.default), {})
}

/** The strings of features, loaded with their routes; en-gb is their fallback. */
const featureLoaders = {
  'system-settings': {
    'en-gb': () => import('./messages/system-settings/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/system-settings/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/system-settings/sk-sk.json').then((m) => m.default),
  },
  administrators: {
    'en-gb': () => import('./messages/administrators/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/administrators/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/administrators/sk-sk.json').then((m) => m.default),
  },
  domains: {
    'en-gb': () => import('./messages/domains/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/domains/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/domains/sk-sk.json').then((m) => m.default),
  },
  // UI 003: the mailbox and mailbox template screens.
  mailboxes: {
    'en-gb': () => import('./messages/mailboxes/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/mailboxes/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/mailboxes/sk-sk.json').then((m) => m.default),
  },
  'sync-jobs': {
    'en-gb': () => import('./messages/sync-jobs/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/sync-jobs/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/sync-jobs/sk-sk.json').then((m) => m.default),
  },
  // UI 012: the identity provider and OAuth2 apps screens.
  identityProviders: {
    'en-gb': () => import('./messages/identity-providers/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/identity-providers/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/identity-providers/sk-sk.json').then((m) => m.default),
  },
  // UI 004: the alias, alias domain and resource screens ("Allow to send as" stays in the app's
  // strings, as UI 003's mailbox page shows it).
  aliases: {
    'en-gb': () => import('./messages/aliases/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/aliases/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/aliases/sk-sk.json').then((m) => m.default),
  },
  // UI 010: DKIM, MTA-STS and DNS diagnostics, loaded with the DNS routes and the sections that the
  // domain page mounts. The DKIM, diagnostics and MTA-STS strings are kept in three files and
  // loaded together.
  dns: {
    'en-gb': () =>
      mergeAll([
        import('./messages/dns/en-gb.json'),
        import('./messages/dns-diagnostics/en-gb.json'),
        import('./messages/dns-mta-sts/en-gb.json'),
      ]),
    'cs-cz': () =>
      mergeAll([
        import('./messages/dns/cs-cz.json'),
        import('./messages/dns-diagnostics/cs-cz.json'),
        import('./messages/dns-mta-sts/cs-cz.json'),
      ]),
    'sk-sk': () =>
      mergeAll([
        import('./messages/dns/sk-sk.json'),
        import('./messages/dns-diagnostics/sk-sk.json'),
        import('./messages/dns-mta-sts/sk-sk.json'),
      ]),
  },
  routing: {
    'en-gb': () => import('./messages/routing/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/routing/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/routing/sk-sk.json').then((m) => m.default),
  },
  // UI 011: the operations screens; `operations` is shared by all of them, the others belong to
  // one screen each (logs with Rspamd, the mail queue, Fail2ban).
  operations: {
    'en-gb': () => import('./messages/operations/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/operations/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/operations/sk-sk.json').then((m) => m.default),
  },
  operationsLogs: {
    'en-gb': () => import('./messages/operations-logs/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/operations-logs/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/operations-logs/sk-sk.json').then((m) => m.default),
  },
  operationsQueue: {
    'en-gb': () => import('./messages/operations-queue/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/operations-queue/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/operations-queue/sk-sk.json').then((m) => m.default),
  },
  operationsFail2ban: {
    'en-gb': () => import('./messages/operations-fail2ban/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/operations-fail2ban/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/operations-fail2ban/sk-sk.json').then((m) => m.default),
  },
  // UI 006: the quarantine, spam policy and rate limit screens and the sections that the domain,
  // alias domain and mailbox pages mount, loaded together; each area keeps its own files.
  quarantine: {
    'en-gb': () =>
      mergeAll([
        import('./messages/quarantine/en-gb.json'),
        import('./messages/quarantine-admin/en-gb.json'),
        import('./messages/spam-filter/en-gb.json'),
        import('./messages/rate-limits/en-gb.json'),
      ]),
    'cs-cz': () =>
      mergeAll([
        import('./messages/quarantine/cs-cz.json'),
        import('./messages/quarantine-admin/cs-cz.json'),
        import('./messages/spam-filter/cs-cz.json'),
        import('./messages/rate-limits/cs-cz.json'),
      ]),
    'sk-sk': () =>
      mergeAll([
        import('./messages/quarantine/sk-sk.json'),
        import('./messages/quarantine-admin/sk-sk.json'),
        import('./messages/spam-filter/sk-sk.json'),
        import('./messages/rate-limits/sk-sk.json'),
      ]),
  },
  // UI 005: My account, the mailbox context's self-service sections and Mail setup › Filters, loaded
  // with their routes and with the pending-actions screen (second-factor setup).
  account: {
    'en-gb': () => import('./messages/account/en-gb.json').then((m) => m.default),
    'cs-cz': () => import('./messages/account/cs-cz.json').then((m) => m.default),
    'sk-sk': () => import('./messages/account/sk-sk.json').then((m) => m.default),
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

export {
  hasLegacy,
  legacyStatus,
  loadLegacy,
  lt,
  ltEnglish,
  prefetchLegacy,
  type LegacyKey,
} from './legacy'
export type { LegacyArg, LegacyNamed } from './legacy-format'
export { legacy, resolveText, type LegacyRef, type TextRef } from './text'

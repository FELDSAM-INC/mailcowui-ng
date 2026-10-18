// mailcow's own translations, used one to one (constitution IV 1.3.0, research R15). They are
// loaded at runtime from the installation's `/lang/lang.<code>.json`, on the same origin, so the
// app shows exactly what that installation's classic interface shows: a fork's wording, an
// operator's changes, the installed version's texts. The selected file is merged over
// `lang.en-gb.json` as `data/web/inc/prerequisites.inc.php` does, so a missing key falls back to
// English. The bundled upstream snapshot (`snapshot/lang.en-gb.json`, a lazy chunk) is used only
// when `/lang/` cannot be loaded, or for a key the installation's files lack.
import { shallowReadonly, shallowRef } from 'vue'

import { formatLegacy, type LegacyArg, type LegacyNamed } from './legacy-format'
import { DEFAULT_LOCALE, type AppLocale } from './locales'
import type snapshot from './snapshot/lang.en-gb.json'

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends object
      ? `${K}.${Leaves<T[K]>}`
      : never
}[keyof T & string]

/** A key of mailcow's language files, `<section>.<key>`, checked against the en-gb snapshot. */
export type LegacyKey = Leaves<typeof snapshot>

export interface LegacyTree {
  [key: string]: string | LegacyTree
}

export interface LegacyStatus {
  locale: AppLocale
  /** Where the English base came from: the installation, the bundled snapshot, or not loaded. */
  base: 'installation' | 'snapshot' | 'none'
  /** Whether the selected language's own file was loaded (always false for en-gb). */
  selected: boolean
}

const messages = shallowRef<LegacyTree>({})
const status = shallowRef<LegacyStatus>({ locale: DEFAULT_LOCALE, base: 'none', selected: false })

/** The language and sources of the loaded texts. */
export const legacyStatus = shallowReadonly(status)

const files = new Map<string, Promise<LegacyTree | null>>()
let snapshotTree: Promise<LegacyTree> | null = null
/** The snapshot laid under the installation's files once one of their keys was missing. */
let completion: LegacyTree | null = null
let completing: Promise<void> | null = null
let generation = 0

function isTree(value: unknown): value is LegacyTree {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function fetchFile(code: string): Promise<LegacyTree | null> {
  try {
    // A plain same-origin GET, so that it reuses index.html's preload of lang.en-gb.json.
    const response = await fetch(`/lang/lang.${code}.json`, { credentials: 'same-origin' })
    if (!response.ok) return null
    const data: unknown = await response.json()
    return isTree(data) ? data : null
  } catch {
    return null
  }
}

/** One request per file; a failed one is tried again next time. */
function file(code: string): Promise<LegacyTree | null> {
  let pending = files.get(code)
  if (!pending) {
    pending = fetchFile(code).then((tree) => {
      if (!tree) files.delete(code)
      return tree
    })
    files.set(code, pending)
  }
  return pending
}

/** The bundled snapshot; an empty tree if even its chunk cannot be loaded (keys show instead). */
function loadSnapshot(): Promise<LegacyTree> {
  snapshotTree ??= import('./snapshot/lang.en-gb.json').then(
    (module): LegacyTree => module.default,
    () => {
      snapshotTree = null
      return {}
    },
  )
  return snapshotTree
}

/**
 * The classic interface's merge (`array_merge_real`): each section of `over` replaces the keys of
 * the same section in `base`; a group inside a section is replaced as a whole.
 */
export function mergeLegacy(base: LegacyTree, over: LegacyTree): LegacyTree {
  const merged: LegacyTree = { ...base }
  for (const [section, value] of Object.entries(over)) {
    const current = merged[section]
    merged[section] = isTree(current) && isTree(value) ? { ...current, ...value } : value
  }
  return merged
}

/** Starts loading the files of a language, for example while the start sequence runs. */
export function prefetchLegacy(locale: AppLocale): void {
  void file(DEFAULT_LOCALE)
  if (locale !== DEFAULT_LOCALE) void file(locale)
}

/** Loads and applies a language's texts. The last call wins when calls overlap. */
export async function loadLegacy(locale: AppLocale): Promise<void> {
  const run = ++generation
  const [installed, selected] = await Promise.all([
    file(DEFAULT_LOCALE),
    locale === DEFAULT_LOCALE ? Promise.resolve(null) : file(locale),
  ])
  const base = installed ?? (await loadSnapshot())
  if (run !== generation) return
  const english = installed && completion ? mergeLegacy(completion, base) : base
  messages.value = selected ? mergeLegacy(english, selected) : english
  status.value = { locale, base: installed ? 'installation' : 'snapshot', selected: !!selected }
}

/** Lays the snapshot under the installation's texts, for keys an older installation lacks. */
function completeFromSnapshot(): void {
  if (completing || status.value.base !== 'installation') return
  completing = loadSnapshot().then((tree) => {
    completion = tree
    messages.value = mergeLegacy(tree, messages.value)
  })
}

function lookup(key: string): string | undefined {
  let node: string | LegacyTree | undefined = messages.value
  for (const part of key.split('.')) {
    if (!isTree(node)) return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

/** A legacy value as the file has it, or the key while it is not available. Reactive. */
export function legacyRaw(key: LegacyKey): string {
  const value = lookup(key)
  if (value !== undefined) return value
  completeFromSnapshot()
  return key
}

/** Whether the loaded texts have a key. */
export function hasLegacy(key: string): boolean {
  return lookup(key) !== undefined
}

/**
 * A legacy text with its placeholders filled: `lt('success.mailbox_added', address)`, or
 * `lt('datatables.info', { _START_: 1, _END_: 25, _TOTAL_: 30 })`. For display, prefer
 * `<LegacyText>`, which also renders the values that contain HTML.
 */
export function lt(key: LegacyKey, ...args: (LegacyArg | LegacyNamed)[]): string {
  const positional = args.filter((arg): arg is LegacyArg => typeof arg !== 'object')
  const named = args.find((arg): arg is LegacyNamed => typeof arg === 'object') ?? {}
  return formatLegacy(legacyRaw(key), positional, named)
}

/** Forgets the loaded texts and files (tests). */
export function resetLegacy(): void {
  generation += 1
  files.clear()
  completion = null
  completing = null
  messages.value = {}
  status.value = { locale: DEFAULT_LOCALE, base: 'none', selected: false }
}

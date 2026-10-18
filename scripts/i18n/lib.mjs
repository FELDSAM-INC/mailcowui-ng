// Shared logic of the translation tooling (constitution IV 1.3.0, research R15, R27). Pure
// functions only; the command-line script check.mjs does the file access.

/** The locales of the app's new strings. Every other locale falls back to en-gb. */
export const LOCALES = ['en-gb', 'cs-cz', 'sk-sk']

export function getPath(object, dotted) {
  let node = object
  for (const part of dotted.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined
    node = node[part]
  }
  return node
}

/** Flattens nested messages into a dotted-key map. */
export function flatten(object, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(object ?? {})) {
    const dotted = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object') flatten(value, dotted, out)
    else out.set(dotted, value)
  }
  return out
}

/** Named and list placeholders of a message, without literal interpolations. */
export function placeholders(message) {
  if (typeof message !== 'string') return []
  const names = new Set()
  for (const match of message.matchAll(/\{\s*([A-Za-z0-9_]+)\s*\}/g)) names.add(match[1])
  return [...names].sort()
}

/** Every problem type named as /api/v2/problems/<name> in the contract text. */
export function problemNamesFromContract(text) {
  const names = new Set()
  for (const match of text.matchAll(/\/api\/v2\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)/g)) {
    names.add(match[1])
  }
  return [...names].sort()
}

/** The `export const <name>Values = [...]` arrays of the generated schema. */
export function enumValuesFromSchema(schemaTs) {
  const result = {}
  for (const match of schemaTs.matchAll(/^export const (\w+Values)\b[^=]*=\s*(\[[^\]]*\]);?$/gm)) {
    result[match[1]] = JSON.parse(match[2])
  }
  return result
}

/**
 * Contract enumerations whose every value needs a translation (research R27, rule 3), with the
 * message namespace each one uses. A value may instead be listed in `LEGACY_TEXTS`
 * (`src/i18n/legacy-messages.ts`). Pending actions and second-factor types use legacy keys in typed
 * tables, so TypeScript checks them.
 */
export const ENUM_NAMESPACES = {
  validationRuleCodeValues: 'validation',
  auditEventTypeValues: 'enums.auditEventType',
  auditFailureReasonValues: 'enums.auditFailureReason',
  auditOutcomeValues: 'enums.auditOutcome',
  auditTargetTypeValues: 'enums.auditTargetType',
  authMethodValues: 'enums.authMethod',
  roleValues: 'roles',
  apiKeyStatusValues: 'enums.apiKeyStatus',
  apiKeyAccessLevelValues: 'enums.apiKeyAccessLevel',
  themeValues: 'themes',
  announcementTypeOneOf0Values: 'enums.announcementType',
}

/** The keys that rule 3 requires, from the enumeration arrays and the problem type names. */
export function requiredKeys({ enums, problemNames }) {
  const keys = new Set()
  for (const [constName, namespace] of Object.entries(ENUM_NAMESPACES)) {
    for (const value of enums[constName] ?? []) keys.add(`${namespace}.${value}`)
  }
  const problems = new Set(problemNames)
  for (const type of enums.knownProblemTypeValues ?? []) {
    const name = String(type).split('/').at(-1)
    if (name) problems.add(name)
  }
  for (const name of problems) keys.add(`problem.${name}`)
  return [...keys].sort()
}

/** Message namespaces whose keys are built at runtime; never reported as unused. */
export const DYNAMIC_NAMESPACES = ['problem.', 'validation.', 'enums.', 'roles.', 'themes.']

const LEGACY_USES = [
  // lt('section.key', …) and legacy('section.key', …)
  /\b(?:lt|legacy)\(\s*(['"])([a-z0-9_]+(?:\.[A-Za-z0-9_-]+)+)\1/g,
  // <LegacyText k="section.key"> and :k="'section.key'"
  /<LegacyText\b[^>]*?\sk="([a-z0-9_]+(?:\.[A-Za-z0-9_-]+)+)"/g,
  /<LegacyText\b[^>]*?\s:k="'([a-z0-9_]+(?:\.[A-Za-z0-9_-]+)+)'"/g,
]

/** The legacy keys a source text uses through `lt()`, `legacy()` and `<LegacyText k>`. */
export function legacyKeysInSource(text) {
  const keys = new Set()
  for (const pattern of LEGACY_USES) {
    for (const match of text.matchAll(pattern)) keys.add(match.at(-1))
  }
  return [...keys].sort()
}

/**
 * String literals of a source text that name a new string: a quoted dotted key whose first part is
 * one of the app's message namespaces (`'auth.signIn.showPassword'`).
 */
export function appKeysInSource(text, namespaces) {
  const keys = new Set()
  // Not a template attribute (`v-if="state.flag"`): its double quotes hold an expression.
  for (const match of text.matchAll(
    /(?<!=)(['"`])([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)+)\1/g,
  )) {
    const key = match[2]
    if (namespaces.includes(key.split('.')[0])) keys.add(key)
  }
  return [...keys].sort()
}

/** The `'app.key': 'legacy.key'` entries of `LEGACY_TEXTS` in `src/i18n/legacy-messages.ts`. */
export function legacyTextsFromSource(text) {
  const block = /LEGACY_TEXTS[^=]*=\s*\{([\s\S]*?)\n\}/.exec(text)?.[1] ?? ''
  const entries = {}
  for (const match of block.matchAll(/'([^']+)':\s*'([^']+)'/g)) entries[match[1]] = match[2]
  return entries
}

/**
 * The completeness check of research R27 (constitution IV 1.3.0). Returns errors (CI fails) and
 * warnings.
 */
export function checkMessages({
  app,
  required,
  snapshot,
  legacyKeysUsed = [],
  legacyTexts = {},
  appKeysUsed = [],
  usedKeys,
}) {
  const errors = []
  const warnings = []
  const flat = Object.fromEntries(LOCALES.map((locale) => [locale, flatten(app[locale])]))

  // Rule 1: equal key sets, no empty values.
  const allKeys = new Set(LOCALES.flatMap((locale) => [...flat[locale].keys()]))
  for (const key of [...allKeys].sort()) {
    for (const locale of LOCALES) {
      const value = flat[locale].get(key)
      if (value === undefined) errors.push(`${locale}: ${key} is missing`)
      else if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`${locale}: ${key} is empty`)
      }
    }
    // Rule 2: equal placeholder sets.
    const reference = placeholders(flat['en-gb'].get(key)).join(',')
    for (const locale of LOCALES.slice(1)) {
      const value = flat[locale].get(key)
      if (value === undefined) continue
      const own = placeholders(value).join(',')
      if (own !== reference) {
        errors.push(`${locale}: ${key} has placeholders {${own}}, en-gb has {${reference}}`)
      }
    }
  }

  // Rule 3: required keys, as new strings or through LEGACY_TEXTS (never both).
  for (const [key, target] of Object.entries(legacyTexts)) {
    if (allKeys.has(key)) errors.push(`${key} is in LEGACY_TEXTS and must not be a new string`)
    if (typeof getPath(snapshot, target) !== 'string') {
      errors.push(`LEGACY_TEXTS maps ${key} to ${target}, which the en-gb snapshot lacks`)
    }
  }
  for (const key of required) {
    if (key in legacyTexts) continue
    for (const locale of LOCALES) {
      if (!flat[locale].has(key)) errors.push(`${locale}: required key ${key} is missing`)
    }
  }

  // Rule 4: banned words in new strings (legacy texts are shown verbatim and never checked).
  for (const locale of LOCALES) {
    for (const [key, value] of flat[locale]) {
      if (typeof value !== 'string') continue
      if (/fido2/i.test(value)) errors.push(`${locale}: ${key} contains "FIDO2"`)
      if (/touch\s*id/i.test(value)) errors.push(`${locale}: ${key} contains "Touch ID"`)
      if (locale === 'en-gb' && /\blegacy\b/i.test(value)) {
        errors.push(`${locale}: ${key} contains "legacy" (say "the classic interface")`)
      }
    }
  }

  // Rule 5: every legacy key the source uses is a text of the en-gb snapshot.
  for (const key of legacyKeysUsed) {
    if (typeof getPath(snapshot, key) !== 'string') {
      errors.push(`${key} is used as a legacy key but is not a text of the en-gb snapshot`)
    }
  }

  // Rule 7: every new-string key the source names exists (or comes from LEGACY_TEXTS). A group's
  // name (`enums.authMethod`, completed at runtime) is not a key.
  const groups = new Set(
    [...allKeys, ...Object.keys(legacyTexts)].flatMap((key) =>
      key
        .split('.')
        .slice(1)
        .map((_, index, parts) => [key.split('.')[0], ...parts.slice(0, index)].join('.')),
    ),
  )
  for (const key of appKeysUsed) {
    if (!allKeys.has(key) && !(key in legacyTexts) && !groups.has(key)) {
      errors.push(`${key} is used in the source but is not a new string in en-gb`)
    }
  }

  // Rule 6: no unused new strings.
  if (usedKeys) {
    for (const key of [...allKeys].sort()) {
      if (usedKeys.has(key)) continue
      if (DYNAMIC_NAMESPACES.some((prefix) => key.startsWith(prefix))) continue
      errors.push(`${key} is unused`)
    }
  }

  return { errors, warnings }
}

/** Text for comparing meanings: no markup, placeholders, punctuation, glyphs or case. */
function comparable(value) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\{[^}]*\}|%(?:\d+\$)?[sd]|_[A-Z]+_/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * New strings whose en-gb text a legacy key already has, for review (not a failure): the legacy
 * key may be the one to use (constitution IV, "New strings are minimal").
 */
export function duplicateLegacyMeanings(appEn, snapshot) {
  const legacy = new Map()
  for (const [key, value] of flatten(snapshot)) {
    if (typeof value !== 'string') continue
    const text = comparable(value)
    if (!text) continue
    legacy.set(text, [...(legacy.get(text) ?? []), key])
  }
  const result = []
  for (const [key, value] of flatten(appEn)) {
    if (typeof value !== 'string') continue
    const keys = legacy.get(comparable(value))
    if (keys) result.push({ key, value, legacyKeys: keys.sort() })
  }
  return result.sort((a, b) => a.key.localeCompare(b.key))
}

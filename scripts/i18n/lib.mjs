// Shared logic of the translation tooling (research R15, R27). Pure functions only; the
// command-line scripts import-legacy.mjs and check.mjs do the file and git access.

export const LOCALES = ['en-gb', 'cs-cz', 'sk-sk']

const DECORATIVE = /^[\s>»›]+|[\s>»›]+$/g
const SPECIAL = /[{}@$|]/g

/** Removes the decorative leading and trailing glyphs legacy uses ("> Forgot Password?"). */
export function stripDecorations(value) {
  return value.replace(DECORATIVE, '')
}

/** Escapes vue-i18n's special characters as literal interpolations, e.g. `{'@'}`. */
export function escapeForVueI18n(value) {
  return value.replace(SPECIAL, (char) => `{'${char}'}`)
}

/** Converts one legacy value into a vue-i18n message. */
export function convertLegacyValue(value) {
  let index = 0
  return escapeForVueI18n(stripDecorations(value)).replace(/%s/g, () => `{${index++}}`)
}

/** Why a legacy value must not be reused, or null (FR-015, FR-086). */
export function refusalReason(value) {
  if (/<\/?[a-z][^>]*>|&[a-z]+;|&#\d+;/i.test(value)) return 'html'
  if (/fido2/i.test(value)) return 'fido2'
  if (/touch\s*id/i.test(value)) return 'touch-id'
  return null
}

export function getPath(object, dotted) {
  let node = object
  for (const part of dotted.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined
    node = node[part]
  }
  return node
}

export function setPath(object, dotted, value) {
  const parts = dotted.split('.')
  let node = object
  for (const part of parts.slice(0, -1)) {
    if (node[part] === undefined) node[part] = {}
    if (typeof node[part] !== 'object' || node[part] === null) {
      throw new Error(`Key conflict at ${dotted}`)
    }
    node = node[part]
  }
  node[parts.at(-1)] = value
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

/** Deep merge of two message trees; `b` wins. */
export function merge(a, b) {
  const out = structuredClone(a ?? {})
  for (const [key, value] of flatten(b)) setPath(out, key, value)
  return out
}

/**
 * Builds one locale's legacy layer from `legacy-map.json` and that locale's legacy file. Keys the
 * legacy file lacks are left out (and reported); a value with HTML or a banned name aborts.
 */
export function buildLegacyLayer(legacyMap, legacySource) {
  const layer = {}
  const missing = []
  const refused = []
  for (const [appKey, legacyKey] of Object.entries(legacyMap)) {
    const value = getPath(legacySource, legacyKey)
    if (typeof value !== 'string') {
      missing.push(appKey)
      continue
    }
    const reason = refusalReason(value)
    if (reason) {
      refused.push(`${appKey} (${legacyKey}): ${reason}`)
      continue
    }
    setPath(layer, appKey, convertLegacyValue(value))
  }
  if (refused.length > 0) {
    throw new Error(`Refused legacy values:\n  ${refused.join('\n  ')}`)
  }
  return { layer, missing }
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
 * message namespace each one uses.
 */
export const ENUM_NAMESPACES = {
  validationRuleCodeValues: 'validation',
  auditEventTypeValues: 'enums.auditEventType',
  auditFailureReasonValues: 'enums.auditFailureReason',
  auditOutcomeValues: 'enums.auditOutcome',
  auditTargetTypeValues: 'enums.auditTargetType',
  authMethodValues: 'enums.authMethod',
  roleValues: 'roles',
  pendingActionValues: 'enums.pendingAction',
  secondFactorTypeValues: 'enums.secondFactorType',
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
export const DYNAMIC_NAMESPACES = ['problem.', 'validation.', 'enums.', 'roles.', 'themes.', 'nav.']

/**
 * The completeness check of research R27. Returns errors (CI fails) and warnings (unused keys).
 */
export function checkMessages({ app, legacy, legacyMap, required, usedKeys }) {
  const errors = []
  const warnings = []
  const flat = {}
  for (const locale of LOCALES) {
    const appFlat = flatten(app[locale])
    const legacyFlat = flatten(legacy[locale])
    // Rule 5: a key in both layers of the same locale.
    for (const key of appFlat.keys()) {
      if (legacyFlat.has(key)) {
        errors.push(`${locale}: ${key} is defined in both the legacy and the app layer`)
      }
    }
    flat[locale] = new Map([...legacyFlat, ...appFlat])
  }

  // Rule 5: legacy-map keys.
  const enLegacy = flatten(legacy['en-gb'])
  for (const appKey of Object.keys(legacyMap)) {
    if (!enLegacy.has(appKey)) {
      errors.push(`${appKey} is in legacy-map.json but missing from the en-gb legacy file`)
      continue
    }
    for (const locale of LOCALES.slice(1)) {
      const inLegacy = flatten(legacy[locale]).has(appKey)
      const inApp = flatten(app[locale]).has(appKey)
      if (!inLegacy && !inApp) {
        errors.push(
          `${locale}: ${appKey} is missing from the ${locale} legacy file and must be supplied by the ${locale} app layer`,
        )
      }
    }
  }

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

  // Rule 3: required keys.
  for (const key of required) {
    for (const locale of LOCALES) {
      if (!flat[locale].has(key)) errors.push(`${locale}: required key ${key} is missing`)
    }
  }

  // Rule 4: banned words.
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

  // Unused keys: warnings only.
  if (usedKeys) {
    for (const key of [...allKeys].sort()) {
      if (usedKeys.has(key)) continue
      if (DYNAMIC_NAMESPACES.some((prefix) => key.startsWith(prefix))) continue
      warnings.push(`${key} looks unused`)
    }
  }

  return { errors, warnings }
}

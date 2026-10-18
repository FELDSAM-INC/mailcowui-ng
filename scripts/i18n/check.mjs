// Translation check (constitution IV 1.3.0, SC-006, research R27). Fails when a new string is
// incomplete in en-gb, cs-cz or sk-sk, is unused, or breaks a rule of research R27, and when the
// source uses a legacy key that the bundled en-gb snapshot lacks. It lists, for review only, the
// new strings whose English text a legacy key already has.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  checkCoverage,
  checkMessages,
  duplicateLegacyMeanings,
  enumValuesFromSchema,
  flatten,
  legacyKeysInSource,
  legacyTextsFromSource,
  appKeysInSource,
  LOCALES,
  problemNamesFromContract,
} from './lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {})

const app = Object.fromEntries(
  LOCALES.map((locale) => [locale, readJson(join(root, 'src/i18n/messages', `${locale}.json`))]),
)
const snapshot = readJson(join(root, 'src/i18n/snapshot/lang.en-gb.json'))

const enums = enumValuesFromSchema(readFileSync(join(root, 'src/api/generated/schema.ts'), 'utf8'))
const contractText = readFileSync(join(root, 'contract/openapi.json'), 'utf8')
const problemNames = problemNamesFromContract(contractText)
// The coverage manifest scopes the growing shared enumerations (UI 002 research D2): their listed
// values need a text, the others fall back to a generic label.
const coverage = readJson(join(root, 'src/i18n/coverage.json'))
const covered = checkCoverage({ coverage, enums, problemNames, contract: JSON.parse(contractText) })
const required = covered.required

function sourceFiles(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name === 'generated') continue
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path))
    else if (/\.(ts|vue)$/.test(name)) files.push(path)
  }
  return files
}
const files = sourceFiles(join(root, 'src'))
const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')

// New strings used literally, or under a prefix built at runtime (`auditLog.columns.${column}`).
const allKeys = new Set(LOCALES.flatMap((locale) => [...flatten(app[locale]).keys()]))
const prefixes = [...source.matchAll(/[`'"]([A-Za-z0-9_.-]+)\.\$\{/g)].map((m) => `${m[1]}.`)
const usedKeys = new Set(
  [...allKeys].filter(
    (key) =>
      source.includes(`'${key}'`) ||
      source.includes(`"${key}"`) ||
      source.includes(`\`${key}\``) ||
      prefixes.some((prefix) => key.startsWith(prefix)),
  ),
)

const legacyKeysUsed = legacyKeysInSource(source)
const legacyTexts = legacyTextsFromSource(
  readFileSync(join(root, 'src/i18n/legacy-messages.ts'), 'utf8'),
)
const appKeysUsed = appKeysInSource(source, Object.keys(app['en-gb']))
const checked = checkMessages({
  app,
  required,
  snapshot,
  legacyKeysUsed,
  legacyTexts,
  appKeysUsed,
  usedKeys,
})
const errors = [...covered.errors, ...checked.errors]
const warnings = [...covered.warnings, ...checked.warnings]

const duplicates = duplicateLegacyMeanings(app['en-gb'], snapshot)
if (duplicates.length > 0) {
  console.log('Review: new strings whose English text a legacy key already has:')
  for (const { key, value, legacyKeys } of duplicates) {
    console.log(`  ${key} "${value}" ~ ${legacyKeys.join(', ')}`)
  }
  console.log('')
}

for (const warning of warnings) console.warn(`warning: ${warning}`)
if (errors.length > 0) {
  for (const error of errors) console.error(`error: ${error}`)
  console.error(`\n${errors.length} translation error(s).`)
  process.exit(1)
}
console.log(
  `Translations complete: ${allKeys.size} new strings in ${LOCALES.join(', ')}; ` +
    `${legacyKeysUsed.length} legacy keys used and ${Object.keys(legacyTexts).length} in ` +
    'LEGACY_TEXTS, all in the en-gb snapshot ' +
    `(${relative(root, join(root, 'src/i18n/snapshot/lang.en-gb.json'))}); ` +
    `${required.length} contract keys covered (${covered.warnings.length} contract values not ` +
    'in src/i18n/coverage.json fall back to generic labels).',
)

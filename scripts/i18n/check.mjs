// Translation completeness check (constitution IV, SC-006, research R27). Fails on any rule of
// research R27; reports unused keys as warnings.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  checkMessages,
  enumValuesFromSchema,
  flatten,
  LOCALES,
  problemNamesFromContract,
  requiredKeys,
} from './lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {})

const app = Object.fromEntries(
  LOCALES.map((locale) => [locale, readJson(join(root, 'src/i18n/messages', `${locale}.json`))]),
)
const legacy = Object.fromEntries(
  LOCALES.map((locale) => [locale, readJson(join(root, 'src/i18n/legacy', `${locale}.json`))]),
)
const legacyMap = readJson(join(root, 'src/i18n/legacy-map.json'))

const enums = enumValuesFromSchema(readFileSync(join(root, 'src/api/generated/schema.ts'), 'utf8'))
const problemNames = problemNamesFromContract(
  readFileSync(join(root, 'contract/openapi.json'), 'utf8'),
)
const required = requiredKeys({ enums, problemNames })

// Keys used literally in the source, for the unused-key warnings.
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
const source = sourceFiles(join(root, 'src'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
const allKeys = new Set(
  LOCALES.flatMap((l) => [...flatten(app[l]).keys(), ...flatten(legacy[l]).keys()]),
)
const usedKeys = new Set(
  [...allKeys].filter((key) => source.includes(`'${key}'`) || source.includes(`"${key}"`)),
)

const { errors, warnings } = checkMessages({ app, legacy, legacyMap, required, usedKeys })

for (const warning of warnings) console.warn(`warning: ${warning}`)
if (errors.length > 0) {
  for (const error of errors) console.error(`error: ${error}`)
  console.error(`\n${errors.length} translation error(s).`)
  process.exit(1)
}
console.log(
  `Translations complete: ${allKeys.size} keys in ${LOCALES.join(', ')}; ` +
    `${required.length} contract keys (${problemNames.length} problem types) covered.`,
)

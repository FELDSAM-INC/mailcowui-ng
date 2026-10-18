// Imports the reused legacy translations (FR-086, research R15).
//
//   node scripts/i18n/import-legacy.mjs [--ref 2026-09a]
//
// Reads data/web/lang/lang.{en-gb,cs-cz,sk-sk}.json of the upstream baseline with
// `git -C ${MAILCOW_REPO:-../mailhosting} show <ref>:<path>` and writes src/i18n/legacy/<locale>.json
// for the keys of src/i18n/legacy-map.json that exist in that locale's legacy file.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildLegacyLayer, LOCALES } from './lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const refIndex = args.indexOf('--ref')
const ref = refIndex >= 0 ? args[refIndex + 1] : '2026-09a'
if (!ref) {
  console.error('usage: import-legacy.mjs [--ref <tag>]')
  process.exit(2)
}
const repo = resolve(root, process.env.MAILCOW_REPO ?? '../mailhosting')
const legacyMap = JSON.parse(readFileSync(join(root, 'src/i18n/legacy-map.json'), 'utf8'))

mkdirSync(join(root, 'src/i18n/legacy'), { recursive: true })
for (const locale of LOCALES) {
  const path = `data/web/lang/lang.${locale}.json`
  const source = JSON.parse(
    execFileSync('git', ['-C', repo, 'show', `${ref}:${path}`], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }),
  )
  const { layer, missing } = buildLegacyLayer(legacyMap, source)
  writeFileSync(
    join(root, 'src/i18n/legacy', `${locale}.json`),
    JSON.stringify(layer, null, 2) + '\n',
  )
  const count = Object.keys(legacyMap).length - missing.length
  console.log(`${locale}: ${count} keys from ${ref}:${path}`)
  if (missing.length > 0) {
    console.log(`  not in this locale's legacy file (supply them in messages/${locale}.json):`)
    for (const key of missing) console.log(`    ${key}`)
  }
}

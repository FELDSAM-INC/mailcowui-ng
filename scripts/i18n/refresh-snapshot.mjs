// Refreshes the bundled copies of mailcow's language files (constitution IV, research R15).
//
//   node scripts/i18n/refresh-snapshot.mjs [--ref 2026-09a]
//
// Copies `data/web/lang/lang.en-gb.json` of the upstream tag, byte for byte, to
// src/i18n/snapshot/lang.en-gb.json: the source of the `LegacyKey` type and the fallback when the
// installation's `/lang/` cannot be loaded. It also copies `lang.cs-cz.json` and
// `lang.sk-sk.json` to tests/fixtures/lang/, which the mock API serves next to the snapshot. The
// files come from `git -C ${MAILCOW_REPO:-../mailhosting} show <ref>:<path>`, never from a working
// tree, so a fork's changes never reach the snapshot.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const refIndex = args.indexOf('--ref')
const ref = refIndex >= 0 ? args[refIndex + 1] : '2026-09a'
if (!ref) {
  console.error('usage: refresh-snapshot.mjs [--ref <tag>]')
  process.exit(2)
}
const repo = resolve(root, process.env.MAILCOW_REPO ?? '../mailhosting')

const targets = [
  ['en-gb', 'src/i18n/snapshot'],
  ['cs-cz', 'tests/fixtures/lang'],
  ['sk-sk', 'tests/fixtures/lang'],
]

for (const [code, dir] of targets) {
  const path = `data/web/lang/lang.${code}.json`
  const content = execFileSync('git', ['-C', repo, 'show', `${ref}:${path}`], {
    maxBuffer: 16 * 1024 * 1024,
  })
  JSON.parse(content.toString('utf8'))
  mkdirSync(join(root, dir), { recursive: true })
  writeFileSync(join(root, dir, `lang.${code}.json`), content)
  console.log(`${dir}/lang.${code}.json: ${content.length} bytes from ${ref}:${path}`)
}

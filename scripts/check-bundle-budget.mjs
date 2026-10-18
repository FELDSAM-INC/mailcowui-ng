// Bundle budget (constitution VII, research R26): the initial JavaScript, i.e. the entry chunk
// and its transitive static imports from dist/.vite/manifest.json, must stay at or below
// 204,800 bytes gzipped. Every lazy chunk's gzipped size is printed as well. mailcow's bundled
// en-gb snapshot must be a lazy chunk (constitution IV 1.3.0): it is loaded only when the
// installation's `/lang/` cannot be.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BUDGET = 204_800
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const manifestPath = join(dist, '.vite/manifest.json')

if (!existsSync(manifestPath)) {
  console.error('dist/.vite/manifest.json is missing. Run `npm run build` first.')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const gzipSize = (file) => gzipSync(readFileSync(join(dist, file)), { level: 9 }).length
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

const entries = Object.entries(manifest).filter(([, chunk]) => chunk.isEntry)
if (entries.length === 0) {
  console.error('No entry chunk in the manifest.')
  process.exit(1)
}

const initial = new Set()
const visit = (key) => {
  const chunk = manifest[key]
  if (!chunk || initial.has(chunk.file)) return
  initial.add(chunk.file)
  for (const imported of chunk.imports ?? []) visit(imported)
}
for (const [key] of entries) visit(key)

let total = 0
console.log('Initial JavaScript (entry and static imports):')
for (const file of [...initial].filter((file) => file.endsWith('.js')).sort()) {
  const size = gzipSize(file)
  total += size
  console.log(`  ${file.padEnd(48)} ${kb(size).padStart(10)}`)
}
console.log(`  ${'total'.padEnd(48)} ${kb(total).padStart(10)}  (budget ${kb(BUDGET)})`)

const lazy = new Map()
for (const chunk of Object.values(manifest)) {
  if (chunk.file.endsWith('.js') && !initial.has(chunk.file)) lazy.set(chunk.file, chunk)
}
console.log('\nLazy chunks:')
for (const [file, chunk] of [...lazy].sort(([a], [b]) => a.localeCompare(b))) {
  const label = chunk.src ? ` (${chunk.src})` : chunk.name ? ` (${chunk.name})` : ''
  console.log(`  ${file.padEnd(48)} ${kb(gzipSize(file)).padStart(10)}${label}`)
}

const SNAPSHOT = 'src/i18n/snapshot/lang.en-gb.json'
const snapshot = manifest[SNAPSHOT]
if (!snapshot) {
  console.error(`\n${SNAPSHOT} is not a chunk of its own: it must be a lazy import.`)
  process.exit(1)
}
if (initial.has(snapshot.file)) {
  console.error(`\n${SNAPSHOT} is part of the initial JavaScript: it must be a lazy import.`)
  process.exit(1)
}

if (total > BUDGET) {
  console.error(`\nInitial JavaScript is ${total} bytes gzipped, above the budget of ${BUDGET}.`)
  process.exit(1)
}
console.log(`\nWithin budget: ${total} of ${BUDGET} bytes gzipped.`)

// Licence gate (constitution "License", research R27): every production dependency, and the dev
// packages whose code ends up in dist/ (Tailwind's and tw-animate-css's CSS), must carry a
// GPL-3.0-compatible licence from the allowlist. Copied template code is covered by
// THIRD_PARTY_NOTICES.md.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ALLOWED = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'MPL-2.0',
  '0BSD',
])
const BUNDLED_DEV_PACKAGES = ['tailwindcss', 'tw-animate-css']

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** True when an SPDX expression is allowed: one allowed licence, or an OR that contains one. */
export function isAllowed(expression) {
  if (typeof expression !== 'string' || expression.trim() === '') return false
  const normalised = expression.replace(/[()]/g, ' ').trim()
  if (/\bAND\b/.test(normalised)) {
    return normalised.split(/\s+AND\s+/).every((part) => isAllowed(part))
  }
  return normalised
    .split(/\s+OR\s+/)
    .map((part) => part.trim())
    .some((part) => ALLOWED.has(part))
}

function licenceOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((entry) => entry.type ?? entry).join(' OR ')
  }
  return undefined
}

function collect(tree, found) {
  for (const [name, node] of Object.entries(tree.dependencies ?? {})) {
    if (!node.path) continue
    const key = `${name}@${node.version}`
    if (found.has(key)) continue
    const pkg = JSON.parse(readFileSync(join(node.path, 'package.json'), 'utf8'))
    found.set(key, licenceOf(pkg))
    collect(node, found)
  }
}

function lsJson(args) {
  try {
    return execFileSync('npm', ['ls', '--all', '--json', '--long', ...args], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (error) {
    // npm ls exits non-zero on peer warnings but still prints the tree.
    if (error.stdout) return error.stdout
    throw error
  }
}

const found = new Map()
collect(JSON.parse(lsJson(['--omit=dev'])), found)
function findNode(tree, name) {
  for (const [child, node] of Object.entries(tree.dependencies ?? {})) {
    if (child === name) return node
    const nested = findNode(node, name)
    if (nested) return nested
  }
  return undefined
}

for (const name of BUNDLED_DEV_PACKAGES) {
  const node = findNode(JSON.parse(lsJson([name])), name)
  if (!node) throw new Error(`${name} is not installed`)
  collect({ dependencies: { [name]: node } }, found)
}

const failures = [...found].filter(([, licence]) => !isAllowed(licence))
console.log(`Checked ${found.size} packages that ship in the build.`)
if (failures.length > 0) {
  console.error('Packages with a licence outside the allowlist:')
  for (const [key, licence] of failures) console.error(`  ${key}: ${licence ?? '(none)'}`)
  process.exit(1)
}
console.log('All licences are GPL-3.0-compatible.')

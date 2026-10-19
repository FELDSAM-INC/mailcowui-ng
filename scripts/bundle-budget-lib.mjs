// Pure logic of the bundle budget (constitution VII, UI 001 research R26, UI 011 research R22).
// `check-bundle-budget.mjs` reads the Vite manifest and the files; this module only walks the
// manifest's static `imports` (never `dynamicImports`) and compares sizes.

/** The initial JavaScript budget: the entry chunk and its static imports, gzipped. */
export const INITIAL_BUDGET = 204_800

/** Keys of every chunk reachable from `key` through static imports, `key` included. */
export function staticClosure(manifest, key, seen = new Set()) {
  const chunk = manifest[key]
  if (!chunk || seen.has(key)) return seen
  seen.add(key)
  for (const imported of chunk.imports ?? []) staticClosure(manifest, imported, seen)
  return seen
}

/** The keys of the entry chunks. */
export function entryKeys(manifest) {
  return Object.entries(manifest)
    .filter(([, chunk]) => chunk.isEntry)
    .map(([key]) => key)
}

const basename = (path) => path.split('/').at(-1) ?? path

/**
 * Whether a manifest chunk is the one a budget names: its chunk name, its file name before the
 * hash, its source file name without extension, or a package of that name in node_modules.
 */
export function chunkMatches(key, chunk, name) {
  if (chunk.name === name) return true
  if (new RegExp(`^${name}-[A-Za-z0-9_-]+\\.js$`).test(basename(chunk.file ?? ''))) return true
  const source = chunk.src ?? key
  if (basename(source).replace(/\.[a-z]+$/, '') === name) return true
  return source.includes(`node_modules/${name}/`)
}

export function findChunks(manifest, name) {
  return Object.entries(manifest)
    .filter(([key, chunk]) => (chunk.file ?? '').endsWith('.js') && chunkMatches(key, chunk, name))
    .map(([key]) => key)
}

/**
 * Checks the initial JavaScript budget and the per-chunk budgets of `budgets`:
 * - `chunks`: `{ name, maxGzipBytes }`, a chunk above its limit fails;
 * - `chunks` and `dynamicOnly`: these chunks must not be reachable through static imports of an
 *   entry or of a `forbidStaticFrom` route chunk;
 * - a named chunk the build does not contain (yet) is skipped with a notice.
 */
export function checkBudgets({ manifest, gzipSize, budgets }) {
  const errors = []
  const notices = []

  const initial = new Set()
  for (const key of entryKeys(manifest)) staticClosure(manifest, key, initial)
  const initialFiles = [...new Set([...initial].map((key) => manifest[key].file))].filter((file) =>
    file.endsWith('.js'),
  )
  const initialTotal = initialFiles.reduce((sum, file) => sum + gzipSize(file), 0)
  if (initialTotal > INITIAL_BUDGET) {
    errors.push(
      `Initial JavaScript is ${initialTotal} bytes gzipped, above the budget of ${INITIAL_BUDGET}.`,
    )
  }

  const roots = [...entryKeys(manifest).map((key) => ({ key, label: 'the entry' }))]
  for (const name of budgets.forbidStaticFrom ?? []) {
    const found = findChunks(manifest, name)
    if (found.length === 0) notices.push(`${name}: not in this build yet, skipped.`)
    for (const key of found) roots.push({ key, label: name })
  }

  const watched = [
    ...(budgets.chunks ?? []).map((budget) => ({ name: budget.name, max: budget.maxGzipBytes })),
    ...(budgets.dynamicOnly ?? []).map((name) => ({ name, max: undefined })),
  ]
  for (const { name, max } of watched) {
    const found = findChunks(manifest, name)
    if (found.length === 0) {
      notices.push(`${name}: not in this build yet, skipped.`)
      continue
    }
    for (const key of found) {
      const file = manifest[key].file
      if (max !== undefined) {
        const size = gzipSize(file)
        if (size > max) {
          errors.push(`${name} (${file}) is ${size} bytes gzipped, above its budget of ${max}.`)
        }
      }
      for (const root of roots) {
        if (root.key === key) continue
        if (staticClosure(manifest, root.key).has(key)) {
          errors.push(`${name} (${file}) is reachable through a static import of ${root.label}.`)
        }
      }
    }
  }

  return { errors, notices, initialTotal, initialFiles }
}

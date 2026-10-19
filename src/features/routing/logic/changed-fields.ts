// The members of a save (research R6, conventions "Editing and conflicts"): only the values the
// user changed against the version the form was opened with, strings trimmed. A creation sends the
// filled members.

/** Trims strings; other values are kept. */
export const normalised = (value: unknown) => (typeof value === 'string' ? value.trim() : value)

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalised(a)) === JSON.stringify(normalised(b))
}

/** The changed members of `fields` between the opened entry and the form's values. */
export function changedMembers<T extends object, K extends keyof T & string>(
  opened: T,
  values: Partial<Record<K, unknown>>,
  fields: readonly K[],
): Partial<Record<K, unknown>> {
  const patch: Partial<Record<K, unknown>> = {}
  for (const field of fields) {
    if (!(field in values)) continue
    const value = values[field]
    if (!same(opened[field] ?? null, value ?? null)) patch[field] = normalised(value)
  }
  return patch
}

/** The filled members of a creation: empty strings are left out, strings trimmed. */
export function filledMembers<T extends Record<string, unknown>>(values: T): Partial<T> {
  const body: Partial<T> = {}
  for (const [key, value] of Object.entries(values) as [keyof T, unknown][]) {
    const trimmed = normalised(value)
    if (trimmed === '' || trimmed === undefined || trimmed === null) continue
    body[key] = trimmed as T[keyof T]
  }
  return body
}

/** A version tag as `BulkTarget.version` takes it: without the quotes of a strong ETag (G33). */
export const bareEtag = (etag: string) => etag.replace(/^W\//, '').replaceAll('"', '')

/** A stored value as text (for chips and the outdated notice): strings as they are. */
export function valueText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

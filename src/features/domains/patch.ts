// JSON Merge Patches of the changed members only (UI 002 research D11, FR-030, FR-054): a field is
// sent when its form value differs from the value the form was opened with. Tags compare as sets
// ignoring letter case (the whole set is sent when it changed); quotas are bytes and compare as
// numbers. Read-only members are never sent: only the given fields of the patchable lists.
import { sameFieldValue, type FieldComparison } from '@/shared/composables/useVersionedSave'

const READ_ONLY: ReadonlySet<string> = new Set([
  'name',
  'unicodeName',
  'relayhost',
  'createdAt',
  'modifiedAt',
  'usage',
  'domainAdmins',
  'etag',
  'id',
  'isDefault',
])

/** The read-only members of a template: its name can be changed (except Default's, FR-053). */
export const TEMPLATE_READ_ONLY: ReadonlySet<string> = new Set([
  'id',
  'isDefault',
  'createdAt',
  'modifiedAt',
  'etag',
])

export function buildPatch<T extends object, K extends keyof T & string>(
  base: T,
  form: T,
  fields: readonly K[],
  comparisons: Partial<Record<K, FieldComparison>> = {},
  readOnly: ReadonlySet<string> = READ_ONLY,
): Partial<Pick<T, K>> {
  const patch: Partial<Pick<T, K>> = {}
  for (const field of fields) {
    if (readOnly.has(field)) continue
    if (!sameFieldValue(base[field], form[field], comparisons[field])) patch[field] = form[field]
  }
  return patch
}

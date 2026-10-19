// The DKIM record as the entry shows it (research R7, data-model §2 RecordView): exactly the API's
// record name and value, the host label that DNS providers ask for inside the zone, and the split
// form of quoted pieces of at most 255 characters (the contract guarantees the pieces).
import type { DkimKeyDetails } from '@/api'

export interface RecordView {
  name: string
  hostLabel: string
  value: string
  split: string
}

export function recordView(key: DkimKeyDetails | null | undefined): RecordView | null {
  const record = key?.record
  if (!key || !record || !key.selector) return null
  return {
    name: record.name,
    hostLabel: `${key.selector}._domainkey`,
    value: record.value,
    split: record.valueParts.map((part) => `"${part}"`).join(' '),
  }
}

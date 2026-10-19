// The version tags of the routing mock (UI 009 T005): a strong, quoted hash of the stored settings
// of an entry, never of derived values (usage, `nextHopSharedWith`, `orphaned`).
import { createHash } from 'node:crypto'

export function routingEtag(prefix: string, stored: unknown): string {
  const digest = createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 22)
  return `"${prefix}${digest}"`
}

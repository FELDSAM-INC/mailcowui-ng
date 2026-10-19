// The routing problems shown with legacy's messages (research R19, legacy form map part 2): an
// existing entry with the entry type's `danger.*_exists` at the field the problem names, the shared
// next hop conflicts (`danger.invalid_nexthop_authenticated`, `danger.next_hop_interferes`), and the
// field violations of the routing forms through UI 004's form-context lookup. Messages come from
// the problem's type and members, never from its title or detail.
import type { ApiProblem, BccMapType } from '@/api'
import { lt, text } from '@/i18n'

import { valueText } from './logic/changed-fields'

export type ConflictKind = 'transport' | 'bccMap' | 'recipientMap' | 'tlsPolicyMap'

/** The values a conflict message names: what the user sent. */
export interface ConflictValues {
  destination?: string
  nextHop?: string
  localDestination?: string
  type?: BccMapType
  originalDestination?: string
}

/** legacy's BCC type value (`bcc()` in `functions.address_rewriting.inc.php` fills `%s` with it). */
export const legacyBccType = (type: BccMapType | undefined) =>
  type === 'recipient' ? 'rcpt' : 'sender'

/** A conflict on a field, as legacy reports it, or null for the generic problem message. */
export function conflictOnField(
  kind: ConflictKind,
  problem: ApiProblem,
  values: ConflictValues,
): Record<string, string[]> | null {
  switch (problem.problemName) {
    case 'routing-entry-exists': {
      const field = typeof problem.extensions.field === 'string' ? problem.extensions.field : null
      if (kind === 'transport') {
        return { destination: [lt('danger.transport_dest_exists', values.destination ?? '')] }
      }
      if (kind === 'bccMap') {
        return {
          [field === 'type' ? 'type' : 'localDestination']: [
            lt('danger.bcc_exists', values.localDestination ?? '', legacyBccType(values.type)),
          ],
        }
      }
      if (kind === 'recipientMap') {
        return {
          originalDestination: [
            lt('danger.recipient_map_entry_exists', values.originalDestination ?? ''),
          ],
        }
      }
      return { destination: [lt('danger.tls_policy_map_entry_exists', values.destination ?? '')] }
    }
    case 'next-hop-credentials-differ':
      return { username: [text('problem.next-hop-credentials-differ')] }
    case 'next-hop-interferes':
      return {
        nextHop: [
          text('problem.next-hop-interferes', {
            nextHop: valueText(problem.extensions.nextHop),
            entered: values.nextHop ?? '',
          }),
        ],
      }
    default:
      return null
  }
}

/** The text of a conflict for a bulk result or a batch row. */
export function conflictText(
  kind: ConflictKind,
  problem: ApiProblem,
  values: ConflictValues,
): string | null {
  const onField = conflictOnField(kind, problem, values)
  return onField ? (Object.values(onField)[0]?.[0] ?? null) : null
}

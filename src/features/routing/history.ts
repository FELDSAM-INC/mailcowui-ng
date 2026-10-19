// The audit log targets of routing entries and assignments (research R18, FR-064): the History
// links open UI 001's audit log filtered by target type and identifier. Administrators only.
export type RoutingHistoryTarget =
  | 'relayhost'
  | 'transport'
  | 'bccMap'
  | 'recipientMap'
  | 'tlsPolicyMap'
  | 'forwardingHost'
  | 'domainRelayhostAssignment'
  | 'mailboxRelayhostAssignment'

export function historyTarget(
  type: RoutingHistoryTarget,
  entry: { id: number } | { address: string } | { name: string },
): { targetType: RoutingHistoryTarget; targetId: string } {
  const targetId =
    'id' in entry ? String(entry.id) : 'address' in entry ? entry.address : entry.name
  return { targetType: type, targetId }
}

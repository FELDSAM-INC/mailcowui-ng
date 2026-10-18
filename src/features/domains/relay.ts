// Relay options kept consistent as API 002 normalises them (UI 002 research D14, FR-033), and the
// badge of the domain list (FR-006).

export interface RelayOptions {
  backupMx: boolean
  relayAllRecipients: boolean
  relayUnknownOnly: boolean
}

export type RelayOption = keyof RelayOptions

export type RelayBadge = 'relayUnknownOnly' | 'relayAllRecipients' | 'relay'

const ORDER: RelayOption[] = ['backupMx', 'relayAllRecipients', 'relayUnknownOnly']

/**
 * Applies a switch and its consequences, and names the other options it changed:
 * - "relay non-existing mailboxes only" on turns on the other two;
 * - "relay all recipients" on turns on "relay this domain";
 * - "relay this domain" off turns off the other two;
 * - "relay all recipients" off turns off "relay non-existing mailboxes only".
 */
export function applyRelayChange(
  current: RelayOptions,
  option: RelayOption,
  on: boolean,
): { next: RelayOptions; changed: RelayOption[] } {
  const next = { ...current, [option]: on }
  if (on && option === 'relayUnknownOnly') {
    next.relayAllRecipients = true
    next.backupMx = true
  }
  if (on && option === 'relayAllRecipients') next.backupMx = true
  if (!on && option === 'backupMx') {
    next.relayAllRecipients = false
    next.relayUnknownOnly = false
  }
  if (!on && option === 'relayAllRecipients') next.relayUnknownOnly = false
  const changed = ORDER.filter((key) => key !== option && next[key] !== current[key])
  return { next, changed }
}

export function relayBadge(options: RelayOptions): RelayBadge | null {
  if (options.relayUnknownOnly) return 'relayUnknownOnly'
  if (options.relayAllRecipients) return 'relayAllRecipients'
  if (options.backupMx) return 'relay'
  return null
}

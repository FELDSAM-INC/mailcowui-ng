// Relay options kept consistent (UI 002 T022, research D14, FR-033) and the list badge (FR-006).
import { describe, expect, it } from 'vitest'

import { applyRelayChange, relayBadge } from '@/features/domains/relay'

const off = { backupMx: false, relayAllRecipients: false, relayUnknownOnly: false }
const all = { backupMx: true, relayAllRecipients: true, relayUnknownOnly: true }

describe('relay options', () => {
  it('relay non-existing mailboxes only turns on the other two', () => {
    expect(applyRelayChange(off, 'relayUnknownOnly', true)).toEqual({
      next: all,
      changed: ['backupMx', 'relayAllRecipients'],
    })
  })

  it('relay all recipients turns on relay this domain', () => {
    expect(applyRelayChange(off, 'relayAllRecipients', true)).toEqual({
      next: { backupMx: true, relayAllRecipients: true, relayUnknownOnly: false },
      changed: ['backupMx'],
    })
  })

  it('relay this domain off turns off the other two', () => {
    expect(applyRelayChange(all, 'backupMx', false)).toEqual({
      next: off,
      changed: ['relayAllRecipients', 'relayUnknownOnly'],
    })
  })

  it('relay all recipients off turns off relay non-existing mailboxes only', () => {
    expect(applyRelayChange(all, 'relayAllRecipients', false)).toEqual({
      next: { backupMx: true, relayAllRecipients: false, relayUnknownOnly: false },
      changed: ['relayUnknownOnly'],
    })
  })

  it('changes nothing else for a plain switch', () => {
    expect(applyRelayChange(off, 'backupMx', true)).toEqual({
      next: { ...off, backupMx: true },
      changed: [],
    })
  })

  it('names the badge of each combination', () => {
    expect(relayBadge(off)).toBeNull()
    expect(relayBadge({ ...off, backupMx: true })).toBe('relay')
    expect(relayBadge({ backupMx: true, relayAllRecipients: true, relayUnknownOnly: false })).toBe(
      'relayAllRecipients',
    )
    expect(relayBadge(all)).toBe('relayUnknownOnly')
  })
})

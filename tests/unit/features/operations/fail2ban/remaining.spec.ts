// UI 011 (FR-064, legacy `%02dh %02dm %02ds`): the remaining ban time of an active ban.
import { describe, expect, it } from 'vitest'

import { remainingParts } from '@/features/operations/fail2ban/remaining'

describe('remainingParts', () => {
  it('splits seconds into two-digit hours, minutes and seconds, as legacy formats them', () => {
    expect(remainingParts(1_530)).toEqual({ hours: '00', minutes: '25', seconds: '30' })
    expect(remainingParts(90_061)).toEqual({ hours: '25', minutes: '01', seconds: '01' })
    expect(remainingParts(-5)).toEqual({ hours: '00', minutes: '00', seconds: '00' })
  })
})

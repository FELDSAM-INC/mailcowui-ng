// UI 011 (FR-051, legacy `js/site/queue.js`): recipients read "address (reason)", as legacy lists
// them, and a card shows the first recipient with the number of further ones.
import { describe, expect, it } from 'vitest'

import { recipientText } from '@/features/operations/mail-queue/presentation'

describe('recipientText', () => {
  it('adds the deferral reason in brackets when there is one', () => {
    expect(recipientText({ address: 'carol@partner.example', deferralReason: 'timed out' })).toBe(
      'carol@partner.example (timed out)',
    )
    expect(recipientText({ address: 'bob@example.net', deferralReason: null })).toBe(
      'bob@example.net',
    )
  })
})

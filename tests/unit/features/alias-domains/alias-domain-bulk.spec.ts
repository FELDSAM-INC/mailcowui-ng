// The domain alias mass actions (T083, research R16): activate without a confirmation, deactivate
// with one, delete with the typed count; none of them needs `aliasDomains` (US6-AS7).
import { describe, expect, it } from 'vitest'

import { aliasDomainBulkActions } from '@/features/alias-domains/alias-domain-bulk'

describe('aliasDomainBulkActions', () => {
  it("offers legacy's three actions with their confirmations", () => {
    expect(
      aliasDomainBulkActions().map((action) => [action.action, action.labelKey, action.confirm]),
    ).toEqual([
      ['activate', 'mailbox.activate', 'none'],
      ['deactivate', 'mailbox.deactivate', 'simple'],
      ['delete', 'mailbox.remove', 'typedCount'],
    ])
  })
})

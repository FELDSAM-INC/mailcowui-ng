// The bulk action catalogue (UI 009 T010, research R5): legacy's quick actions with their legacy
// labels, from the generated arrays, and the targets with the unquoted version.
import { describe, expect, it } from 'vitest'

import { lt, resolveText } from '@/i18n'
import {
  BULK_ACTIONS,
  bulkActionLabel,
  isDestructive,
  targetOf,
} from '@/features/routing/logic/bulk-actions'

const label = (...args: Parameters<typeof bulkActionLabel>) =>
  resolveText(bulkActionLabel(...args), (key) => key)

describe('routing bulk actions', () => {
  it('takes every list’s actions from the contract', () => {
    expect(BULK_ACTIONS.relayhosts).toEqual(['activate', 'deactivate', 'delete'])
    expect(BULK_ACTIONS.bccMaps).toEqual([
      'activate',
      'deactivate',
      'switchToSender',
      'switchToRecipient',
      'delete',
    ])
    expect(BULK_ACTIONS.forwardingHosts).toEqual([
      'enableSpamFilter',
      'disableSpamFilter',
      'delete',
    ])
  })

  it('labels them with the legacy keys of each card', () => {
    expect(label('relayhosts', 'activate')).toBe(lt('mailbox.activate'))
    expect(label('relayhosts', 'delete')).toBe(lt('admin.remove'))
    expect(label('recipientMaps', 'delete')).toBe(lt('mailbox.remove'))
    expect(label('bccMaps', 'switchToSender')).toBe(lt('mailbox.bcc_to_sender'))
    expect(label('bccMaps', 'switchToRecipient')).toBe(lt('mailbox.bcc_to_rcpt'))
    expect(label('forwardingHosts', 'enableSpamFilter')).toBe(
      'routing.forwardingHosts.enableSpamFilter',
    )
    expect(label('forwardingHosts', 'disableSpamFilter')).toBe(
      'routing.forwardingHosts.disableSpamFilter',
    )
    expect(label('tlsPolicyMaps', 'deactivate')).toBe(lt('mailbox.deactivate'))
    expect(isDestructive('delete')).toBe(true)
    expect(isDestructive('deactivate')).toBe(false)
  })

  it('sends the ID or the stored address with the version without quotes', () => {
    expect(targetOf({ id: 3, etag: '"r3abc"' })).toEqual({ id: '3', version: 'r3abc' })
    expect(targetOf({ address: '192.0.2.0/24', etag: 'W/"f1"' })).toEqual({
      id: '192.0.2.0/24',
      version: 'f1',
    })
  })
})

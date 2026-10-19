// UI 006 (T012, research R7): "Prohibited by ACL" with the flag's classic label, promoted from
// UI 003 at its second use.
import { describe, expect, it } from 'vitest'

import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'

import { mountWithApp } from '../../support/mount'

describe('AclReadOnlyNote', () => {
  it.each([
    ['quarantine', 'Quarantine actions'],
    ['quarantineAttachments', 'Quarantine attachments'],
    ['quarantineNotification', 'Change quarantine notifications'],
    ['quarantineCategory', 'Change quarantine notification category'],
    ['spamScore', 'Spam score'],
    ['spamPolicy', 'Denylist/Allowlist'],
    ['ratelimit', 'Rate limit'],
    ['protocolAccess', 'Change protocol access'],
  ] as const)('names %s by its classic label', (flag, label) => {
    const wrapper = mountWithApp(AclReadOnlyNote, { props: { id: 'note', flag } })
    expect(wrapper.attributes('id')).toBe('note')
    const texts = wrapper.findAll('span').map((span) => span.text())
    expect(texts).toEqual(['Prohibited by ACL', label])
  })
})

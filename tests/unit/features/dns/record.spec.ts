// The DKIM record view (T034, research R7, data-model §2 RecordView): the host label inside the
// zone, the single value and the split form of quoted 255-character pieces, and no record for an
// incomplete key.
import { describe, expect, it } from 'vitest'

import { recordView } from '@/features/dns/dkim/record'

import { incompleteEntry, keyDetails } from './fixtures'

describe('recordView', () => {
  it('derives the host label and both forms from the API record', () => {
    const key = keyDetails()
    const view = recordView(key)!
    expect(view.name).toBe('dkim._domainkey.example.org')
    expect(view.hostLabel).toBe('dkim._domainkey')
    expect(view.value).toBe(key.record!.value)
    expect(view.split).toBe(`"${key.record!.valueParts[0]}" "${key.record!.valueParts[1]}"`)
  })

  it('is null without a record or a key', () => {
    expect(recordView(incompleteEntry().key)).toBeNull()
    expect(recordView(null)).toBeNull()
  })
})

// The derived address of a new resource (T095, research R14, FR-045): the ASCII letters and digits
// of the description in their letter case, at most 64 characters, at the readable domain.
import { describe, expect, it } from 'vitest'

import { derivedLocalPart, previewAddress } from '@/features/resources/address-preview'

describe('address preview', () => {
  it('keeps ASCII letters and digits in their case and drops the rest', () => {
    expect(derivedLocalPart('Meeting Room 1')).toBe('MeetingRoom1')
    expect(derivedLocalPart('Raum Süd')).toBe('RaumSd')
    expect(derivedLocalPart('!!!')).toBe('')
  })

  it('derives no address for an empty or too long local part, and uses the readable domain', () => {
    expect(previewAddress('Meeting Room 1', 'example.org')).toBe('MeetingRoom1@example.org')
    expect(previewAddress('Büro', 'bücher.example')).toBe('Bro@bücher.example')
    expect(previewAddress('!!!', 'example.org')).toBeNull()
    expect(previewAddress('a'.repeat(65), 'example.org')).toBeNull()
    expect(previewAddress('a'.repeat(64), 'example.org')).toBe(`${'a'.repeat(64)}@example.org`)
    expect(previewAddress('Room', null)).toBe('Room@…')
  })
})

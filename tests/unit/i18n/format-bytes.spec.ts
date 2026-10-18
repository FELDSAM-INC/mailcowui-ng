// Binary sizes for the user's language (UI 002 T020, research D12, FR-016).
import { describe, expect, it } from 'vitest'

import { formatBytes } from '@/i18n/format'

const plain = (text: string) => text.replace(/[  ]/g, ' ')

describe('formatBytes', () => {
  it('shows a quota in the largest unit that represents it exactly', () => {
    expect(plain(formatBytes(10_737_418_240, 'en-gb', { exact: true }))).toBe('10 GiB')
    expect(plain(formatBytes(3_145_728_000, 'en-gb', { exact: true }))).toBe('3,000 MiB')
    expect(plain(formatBytes(3_145_728_000, 'cs-cz', { exact: true }))).toBe('3 000 MiB')
    expect(plain(formatBytes(2 * 1024 ** 4, 'en-gb', { exact: true }))).toBe('2 TiB')
    expect(plain(formatBytes(1_048_576, 'en-gb', { exact: true }))).toBe('1 MiB')
  })

  it('rounds storage to one decimal in the largest fitting unit, locale-formatted', () => {
    expect(plain(formatBytes(10_200_547_328, 'en-gb'))).toBe('9.5 GiB')
    expect(plain(formatBytes(10_200_547_328, 'cs-cz'))).toBe('9,5 GiB')
    expect(plain(formatBytes(1.5 * 1024 ** 4, 'sk-sk'))).toBe('1,5 TiB')
    expect(plain(formatBytes(512, 'en-gb'))).toBe('512 B')
    expect(plain(formatBytes(0, 'en-gb'))).toBe('0 B')
    expect(plain(formatBytes(1536, 'en-gb'))).toBe('1.5 KiB')
  })
})

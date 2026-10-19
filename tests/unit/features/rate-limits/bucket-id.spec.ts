// The bucket identifier check before a reset (T100, data-model §7, FR-058): "RL" followed by
// letters, digits and "=", at most the contract's length, as the rate-limited log shows it.
import { describe, expect, it } from 'vitest'

import { checkBucketId } from '@/features/rate-limits/bucket-id'
import { RATE_LIMIT_BUCKET_ID_MAX_LENGTH } from '@/shared/validation/limits'

describe('checkBucketId', () => {
  it('accepts identifiers of the log, trimmed', () => {
    expect(checkBucketId('RLabc=')).toEqual({ ok: true, bucketId: 'RLabc=' })
    expect(checkBucketId('  RLz8xq6dyb5fjb1kyn9n5wqhzq ')).toEqual({
      ok: true,
      bucketId: 'RLz8xq6dyb5fjb1kyn9n5wqhzq',
    })
    expect(checkBucketId(`RL${'a'.repeat(RATE_LIMIT_BUCKET_ID_MAX_LENGTH - 2)}`).ok).toBe(true)
  })

  it('refuses empty values, other forms and overlong identifiers', () => {
    expect(checkBucketId('')).toEqual({ ok: false, reason: 'required' })
    expect(checkBucketId('   ')).toEqual({ ok: false, reason: 'required' })
    for (const value of ['RL-bad', 'rlabc', 'RL', 'abcRL', 'RL abc', 'RL/abc', 'RLä']) {
      expect(checkBucketId(value)).toEqual({ ok: false, reason: 'invalidFormat' })
    }
    expect(checkBucketId(`RL${'a'.repeat(RATE_LIMIT_BUCKET_ID_MAX_LENGTH - 1)}`)).toEqual({
      ok: false,
      reason: 'tooLong',
    })
  })
})

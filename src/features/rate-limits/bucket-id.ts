// The bucket identifier of a reset (data-model §7, FR-058): checked before sending against the
// contract's `RateLimitBucketId` parameter (`src/shared/validation/limits.ts`), which UI 011's
// rate-limited log uses too. The identifier is case-sensitive, so it is only trimmed.
import {
  RATE_LIMIT_BUCKET_ID_MAX_LENGTH,
  RATE_LIMIT_BUCKET_ID_PATTERN,
} from '@/shared/validation/limits'

export type BucketIdCheck =
  { ok: true; bucketId: string } | { ok: false; reason: 'required' | 'invalidFormat' | 'tooLong' }

export function checkBucketId(value: string): BucketIdCheck {
  const bucketId = value.trim()
  if (bucketId === '') return { ok: false, reason: 'required' }
  if (!RATE_LIMIT_BUCKET_ID_PATTERN.test(bucketId)) return { ok: false, reason: 'invalidFormat' }
  if (bucketId.length > RATE_LIMIT_BUCKET_ID_MAX_LENGTH) return { ok: false, reason: 'tooLong' }
  return { ok: true, bucketId }
}

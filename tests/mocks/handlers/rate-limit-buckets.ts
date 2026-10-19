// Rate limit bucket handler (UI 011 plan item 26, T071): `resetRateLimitBucket` for the rate-limited
// log's "Remove hash", filled by US3. UI 006 may later own this module.
import type { RequestHandler } from 'msw'

export const rateLimitBucketHandlers: RequestHandler[] = []

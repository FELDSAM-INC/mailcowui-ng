// Usage levels of a pair of used value and limit (UI 002 research D10, FR-008): nearly full from
// 90 % of the limit up to the limit, over the limit above it. A limit of 0 counts as full.
export type UsageLevel = 'ok' | 'nearlyFull' | 'over'

export const NEARLY_FULL = 0.9

export function usageLevel(used: number, limit: number): UsageLevel {
  if (used > limit) return 'over'
  if (limit === 0) return 'nearlyFull'
  return used / limit >= NEARLY_FULL ? 'nearlyFull' : 'ok'
}

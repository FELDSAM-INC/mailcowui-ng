// The spam score of a mailbox in tenths (UI 006 research R17, data-model §2 "Score values"): 6.5
// is 65, so the junk ≤ reject comparison is exact. The checks before sending take the range and the
// step from the quarantine capabilities (never hard-coded); the band's three zones are legacy's
// (`templates/user/Spamfilter.twig`), each with its range text as `js/site/user.js` writes it, and a
// display width on a scale that is linear up to one and a half times the reject value (at least
// 20), with the remaining width for the tail up to the maximum.
import type { QuarantineCapabilities } from '@/api'
import type { LegacyKey } from '@/i18n'
import { fromTenths, toTenths } from '@/i18n/parse'

export type Tenths = number
export type ScoreField = 'junkScore' | 'rejectScore'
/** The capabilities' range, widened from the contract's constants. */
export type ScoreRange = { [K in keyof QuarantineCapabilities['spamScore']]: number }

export interface ScoreViolation {
  field: ScoreField
  code: 'outOfRange' | 'notMultipleOf' | 'mustNotExceed'
  params: Record<string, string | number>
}

/** The client checks of a pair (data-model §7): range, step, then junk ≤ reject. */
export function validatePair(junk: Tenths, reject: Tenths, range: ScoreRange): ScoreViolation[] {
  const min = toTenths(range.min)
  const max = toTenths(range.max)
  const step = Math.max(1, toTenths(range.step))
  const violations: ScoreViolation[] = []
  for (const [field, value] of [
    ['junkScore', junk],
    ['rejectScore', reject],
  ] as const) {
    if (value < min || value > max) {
      violations.push({ field, code: 'outOfRange', params: { min: range.min, max: range.max } })
    } else if (value % step !== 0) {
      violations.push({ field, code: 'notMultipleOf', params: { factor: range.step } })
    }
  }
  if (violations.length === 0 && junk > reject) {
    violations.push({
      field: 'junkScore',
      code: 'mustNotExceed',
      params: { field: 'rejectScore', value: fromTenths(reject) },
    })
  }
  return violations
}

export type ZoneId = 'green' | 'yellow' | 'red'

export interface ScoreZone {
  id: ZoneId
  /** In tenths; `to` is exclusive except for the last zone. */
  from: Tenths
  to: Tenths
  labelKey: LegacyKey
  /** The range text: "< {junk}", "{junk} - {reject}", "> {reject}". */
  rangeKey: string
  /** Display width in percent. */
  width: number
}

/** The contract's maximum score (5000) in tenths. */
export const MAX_SCALE_TENTHS = 50_000
const MIN_SCALE_TENTHS = 200
const TAIL_PERCENT = 10

const round = (value: number) => Math.round(value * 100) / 100

export function bandZones(
  junk: Tenths,
  reject: Tenths,
  max: Tenths = MAX_SCALE_TENTHS,
): ScoreZone[] {
  const scale = Math.min(Math.max(Math.ceil(reject * 1.5), MIN_SCALE_TENTHS), max)
  const linear = scale < max ? 100 - TAIL_PERCENT : 100
  const position = (value: Tenths) => round((Math.min(Math.max(value, 0), scale) / scale) * linear)
  const junkAt = position(junk)
  const rejectAt = position(reject)
  return [
    {
      id: 'green',
      from: 0,
      to: junk,
      labelKey: 'user.spamfilter_green',
      rangeKey: 'spamFilter.score.rangeBelow',
      width: junkAt,
    },
    {
      id: 'yellow',
      from: junk,
      to: reject,
      labelKey: 'user.spamfilter_yellow',
      rangeKey: 'spamFilter.score.rangeBetween',
      width: round(rejectAt - junkAt),
    },
    {
      id: 'red',
      from: reject,
      to: max,
      labelKey: 'user.spamfilter_red',
      rangeKey: 'spamFilter.score.rangeAbove',
      width: round(100 - rejectAt),
    },
  ]
}

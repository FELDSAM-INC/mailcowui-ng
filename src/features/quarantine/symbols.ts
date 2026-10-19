// The spam filter's symbols of an item (UI 006 FR-022, research R13), in the order the classic item
// modal sorts them (`js/site/quarantine.js`): positive scores from highest to lowest, then negative
// scores from lowest to highest, then zero scores; equal scores keep their stored order. Each
// score carries its sign in text (FR-079), formatted for the locale.
import type { QuarantineSymbol } from '@/api'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

const group = (score: number) => (score > 0 ? 0 : score < 0 ? 1 : 2)

/** A sorted copy (the sort is stable, so equal scores keep their stored order). */
export function sortSymbols<T extends Pick<QuarantineSymbol, 'score'>>(symbols: readonly T[]): T[] {
  return [...symbols].sort((a, b) => {
    const byGroup = group(a.score) - group(b.score)
    if (byGroup !== 0) return byGroup
    if (a.score > 0) return b.score - a.score
    return a.score - b.score
  })
}

/** `+3.5`, `-1.2` or `0`, with the locale's separators. */
export function formatSymbolScore(score: number, locale: AppLocale): string {
  return formatNumber(score, locale, { signDisplay: 'exceptZero', maximumFractionDigits: 3 })
}

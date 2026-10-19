// UI 006 (T025, T080): mailbox spam scores. Custom values are stored per mailbox; a mailbox with
// only one stored value is custom and takes the other from the defaults. The defaults are the spam
// filter's thresholds, or 5 and 15 with `fallback: true` when it cannot be asked (contract).
import { createHash } from 'node:crypto'

import type { SpamScore } from '@/api'

import type { MockSpamScore } from '../scenarios/state'

/** A server whose spam filter reports 8 and 15 (US4-AS1). */
export const reportedSpamScoreDefaults = (): SpamScore['defaults'] => ({
  junkScore: 8,
  rejectScore: 15,
  fallback: false,
})

/** The spam filter could not be asked: legacy's 5 and 15, marked as fallback values. */
export const fallbackSpamScoreDefaults = (): SpamScore['defaults'] => ({
  junkScore: 5,
  rejectScore: 15,
  fallback: true,
})

export function spamScoreEtag(mailbox: string, stored: MockSpamScore | undefined): string {
  const key = JSON.stringify([
    mailbox.toLowerCase(),
    stored?.junkScore ?? null,
    stored?.rejectScore ?? null,
  ])
  return `"sc${createHash('sha256').update(key).digest('hex').slice(0, 22)}"`
}

/** Tenths, so that 0.1 steps compare exactly. */
export const tenths = (value: number) => Math.round(value * 10)

export function spamScoreView(
  mailbox: string,
  stored: MockSpamScore | undefined,
  defaults: SpamScore['defaults'],
): SpamScore {
  const custom = !!stored && (stored.junkScore !== null || stored.rejectScore !== null)
  return {
    mailbox: mailbox.toLowerCase(),
    junkScore: stored?.junkScore ?? defaults.junkScore,
    rejectScore: stored?.rejectScore ?? defaults.rejectScore,
    custom,
    defaults: { ...defaults },
    etag: spamScoreEtag(mailbox, stored),
  }
}

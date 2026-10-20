import type { SelfServiceCapabilities } from '@/api'
import { lt } from '@/i18n'

export type RecentLoginPeriodLimits = {
  [
    Key in keyof Pick<
      NonNullable<SelfServiceCapabilities['recentLogins']>,
      'minDays' | 'maxDays' | 'defaultDays'
    >
  ]: number
}
export function recentLoginPeriods(limits: RecentLoginPeriodLimits): number[] {
  return [...new Set([1, 7, 14, 31, limits.defaultDays])]
    .filter((days) => days >= limits.minDays && days <= limits.maxDays)
    .sort((a, b) => a - b)
}
export function recentLoginPeriodLabel(days: number): string {
  if (days === 7) return `1 ${lt('user.week')}`
  if (days === 14) return `2 ${lt('user.weeks')}`
  if (days === 31) return `1 ${lt('user.month')}`
  return `${days} ${lt('user.day')}`
}
export const RECENT_LOGIN_SERVICES = [
  'IMAP',
  'POP3',
  'SMTP',
  'SIEVE',
  'EAS',
  'DAV',
  'SSO',
  'SOGO',
  'WEBUI',
] as const

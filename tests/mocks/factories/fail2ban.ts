// Ban service factory (UI 011 T099): the stored settings (and the defaults the ban service reports
// when nothing is stored), the version tag over the stored values, mailcow's default filter rules,
// active bans (IPv4 and IPv6 networks, some queued for lifting) and permanent bans.
import { createHash } from 'node:crypto'

import type { Fail2BanSettings } from '@/api'

export type MockFail2banSettings = Omit<Fail2BanSettings, 'etag' | 'banServiceRunning'>

export interface MockActiveBan {
  network: string
  address: string
  endsAt: string
  queuedForLifting: boolean
}

export interface MockPermanentBan {
  network: string
  address: string
  startedAt: string
}

export const BAN_LIST_ID = '3f1b6c2e-8d4a-4f6b-9c1e-2a7d5e8f0b13'

export function defaultSettings(): MockFail2banSettings {
  return {
    banTime: 1_800,
    maxBanTime: 10_000,
    banTimeIncrement: true,
    maxAttempts: 10,
    retryWindow: 600,
    ipv4PrefixLength: 32,
    ipv6PrefixLength: 128,
    externallyEnforced: false,
    allowlist: ['192.0.2.0/24', 'office.example.org'],
    denylist: ['198.51.100.200', '2001:db8:dead::/48'],
    banListId: BAN_LIST_ID,
    banListUrl: `https://mail.example.org/f2b-banlist?id=${BAN_LIST_ID}`,
    stored: true,
  }
}

/** mailcow's default filter rules (abridged, as the ban service stores them). */
export function defaultRules(): string[] {
  return [
    'mailcow UI: Invalid password for .+ by ([0-9a-f\\.:]+)',
    'warning: .*\\[([0-9a-f\\.:]+)\\]: SASL .+ authentication failed: (?!.*Connection lost to authentication server).+',
    'warning: non-SMTP command from .*\\[([0-9a-f\\.:]+)]:.+',
    'NOQUEUE: reject: RCPT from \\[([0-9a-f\\.:]+)].+Protocol error.+',
    '-login: Disconnected.+ \\(auth failed, .+\\): user=.*, method=.+, rip=([0-9a-f\\.:]+),',
    '-login: Aborted login.+ \\(auth failed .+\\): user=.+, rip=([0-9a-f\\.:]+), lip.+',
    '-login: Aborted login.+ \\(tried to use disallowed .+\\): user=.+, rip=([0-9a-f\\.:]+), lip.+',
    "SOGo.+ Login from '([0-9a-f\\.:]+)' for user .+ might not have worked",
  ]
}

export function settingsEtag(settings: MockFail2banSettings): string {
  const digest = createHash('sha256').update(JSON.stringify(settings)).digest('hex')
  return `"f2b${digest.slice(0, 20)}"`
}

export function rulesEtag(rules: readonly string[]): string {
  return `"rx${createHash('sha256').update(JSON.stringify(rules)).digest('hex').slice(0, 20)}"`
}

const MINUTE = 60_000

export function activeBans(now: number): MockActiveBan[] {
  return [
    {
      network: '203.0.113.0/24',
      address: '203.0.113.0',
      endsAt: new Date(now + 25 * MINUTE).toISOString(),
      queuedForLifting: false,
    },
    {
      network: '2001:db8:1234::/48',
      address: '2001:db8:1234::',
      endsAt: new Date(now + 90 * MINUTE).toISOString(),
      queuedForLifting: false,
    },
    {
      network: '192.0.2.77/32',
      address: '192.0.2.77',
      endsAt: new Date(now + 5 * MINUTE).toISOString(),
      queuedForLifting: true,
    },
  ]
}

export function permanentBans(now: number, denylist: readonly string[]): MockPermanentBan[] {
  return denylist.map((network, index) => ({
    network: network.includes('/') ? network : `${network}/${network.includes(':') ? 128 : 32}`,
    address: network.split('/')[0]!,
    startedAt: new Date(now - (index + 1) * 60 * MINUTE).toISOString(),
  }))
}

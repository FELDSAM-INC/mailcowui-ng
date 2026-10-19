// Recent logins of the mock (UI 005 T011, research R17).
import type { RecentLogin } from '@/api'

export function recentLogin(
  overrides: Partial<RecentLogin> & { service: string; lastSeenAt: string },
): RecentLogin {
  return {
    clientAddress: '198.51.100.7',
    internal: false,
    country: 'DE',
    appPassword: null,
    ...overrides,
  }
}

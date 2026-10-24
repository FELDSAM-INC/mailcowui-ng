import type { Identity } from '@/api'

export function accountLandingPath(identity: Pick<Identity, 'role'>): string {
  return identity.role === 'mailboxUser' ? '/account/overview' : '/account/password'
}

/** The working section for a default sign-in; requested deep links still take precedence. */
export function defaultLandingPath(identity: Pick<Identity, 'role'>): string {
  if (identity.role === 'admin') return '/operations/dashboard'
  return identity.role === 'domainAdmin' ? '/domains' : accountLandingPath(identity)
}

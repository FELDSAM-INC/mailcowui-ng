import type { QueryClient } from '@tanstack/vue-query'

import type { LandingContext } from '@/app/session/landing'
import { cachedIdentity, cachedSession } from '@/app/session/queries'

import { ownMailboxOverviewOptions } from './api/overview'
import { createWebmailHandOff, webmailPath } from './api/webmail'

export async function forwardToWebmail(
  context: LandingContext,
  queryClient: QueryClient,
  navigate: (url: string) => void = (url) => window.location.assign(url),
): Promise<boolean> {
  const { session, identity, intent } = context
  if (
    intent !== 'default' ||
    session.state !== 'active' ||
    session.role !== 'mailboxUser' ||
    session.pendingActions.length ||
    identity?.role !== 'mailboxUser' ||
    identity.pendingActions.length ||
    identity.impersonation
  )
    return false

  const stillCurrent = () => {
    const current = cachedSession(queryClient)
    const who = cachedIdentity(queryClient)
    return (
      current?.state === 'active' &&
      current.username === session.username &&
      current.signedInAt === session.signedInAt &&
      current.pendingActions.length === 0 &&
      who?.username === identity.username &&
      !who.impersonation &&
      who.pendingActions.length === 0
    )
  }
  if (!stillCurrent()) return false
  const overview = await queryClient.fetchQuery(ownMailboxOverviewOptions())
  if (!stillCurrent() || !overview.webmail.enabled || !overview.webmail.redirectAfterSignIn)
    return false
  const handOff = await createWebmailHandOff()
  if (!stillCurrent() || handOff.mailbox !== identity.username) return false
  navigate(webmailPath(handOff.url))
  return true
}

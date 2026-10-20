import { api, requireData } from '@/api'
import { sessionContext } from '@/app/session/context'
import { switchIdentity } from '@/app/session/identity-switch'
import { endSession } from '@/app/session/session-end'
import type { ManagedAccount } from './api'
/** The successful response precedes the session transition; drafts have already been cleared. */
export async function handleOwnAccountSave(
  before: ManagedAccount,
  after: ManagedAccount,
  ownUsername: string,
): Promise<boolean> {
  if (before.username.toLowerCase() !== ownUsername.toLowerCase()) return false
  if (before.active && !after.active) {
    const session = requireData(await api.GET('/session')).data
    if (session.state === 'anonymous')
      await endSession(sessionContext(), { notice: 'selfDeactivated', broadcast: true })
    return true
  }
  if (before.username !== after.username) {
    await switchIdentity({ reason: 'selfRenamed' })
    return true
  }
  return false
}

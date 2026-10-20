import { readonly, ref } from 'vue'
import { queryKeys, type Identity } from '@/api'
import { sessionContext } from '@/app/session/context'
import { switchIdentity } from '@/app/session/identity-switch'
import { canSignInAs, type ActingTarget } from './eligibility'
import { startImpersonation, endImpersonation } from './api'

const pending = ref(false)
export const actingRequestPending = readonly(pending)

/** Complete the switch even if the initiating row unmounts while the server answers. */
export async function beginActing(target: ActingTarget, origin: string): Promise<void> {
  const ctx = sessionContext()
  if (
    pending.value ||
    !canSignInAs(ctx.queryClient.getQueryData<Identity>(queryKeys.identity()), target)
  )
    return
  pending.value = true
  try {
    const result = await startImpersonation({
      role: target.kind,
      username: target.kind === 'mailboxUser' ? target.address : target.username,
    })
    await switchIdentity(
      {
        reason: 'actingStarted',
        identity: result.identity,
        csrfToken: result.csrfToken.token,
        origin,
      },
      ctx,
    )
  } finally {
    pending.value = false
  }
}

export async function returnFromActing(): Promise<void> {
  const ctx = sessionContext()
  if (pending.value || !ctx.queryClient.getQueryData<Identity>(queryKeys.identity())?.impersonation)
    return
  pending.value = true
  try {
    await endImpersonation()
    await switchIdentity({ reason: 'actingEnded' }, ctx)
  } finally {
    pending.value = false
  }
}

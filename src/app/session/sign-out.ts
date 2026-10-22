// Sign-out (FR-036, research R11): DELETE /session without confirmation. On success everything of
// the session is discarded, the other tabs are told and a new anti-forgery token is fetched. When
// the server cannot be reached, nothing changes and the user can retry: a sign-out that did not
// happen is never claimed. UI 012 (FR-053): after a single sign-on session the sign-in screen's
// notice adds that the user is still signed in at the provider.
import { ref, shallowRef } from 'vue'

import {
  api,
  ApiProblem,
  clearCsrfToken,
  isApiProblem,
  queryKeys,
  refreshCsrfToken,
  type Identity,
} from '@/api'

import { clearAllDrafts } from '@/shared/composables/draft-registry'
import { invalidateSessionScope } from '@/api/session-scope'

import { sessionContext, type SessionContext } from './context'
import { anonymousSession, cachedSession } from './queries'
import { goToSignIn } from './session-end'
import { useSessionStore } from './store'

export type SignOutResult = { ok: true } | { ok: false; problem: ApiProblem }

export async function signOut(ctx: SessionContext): Promise<SignOutResult> {
  // UI 012 (FR-053): read before the cache is cleared whether single sign-on began the session.
  const identity = ctx.queryClient.getQueryData<Identity>(queryKeys.identity())
  const viaSingleSignOn = identity?.authentication.method === 'singleSignOn'
  try {
    await api.DELETE('/session')
  } catch (error) {
    const problem = isApiProblem(error)
      ? error
      : ApiProblem.fromParts({ kind: 'network', cause: error })
    // `unauthenticated` means the server session is already gone: the sign-out happened.
    if (!problem.is('unauthenticated')) return { ok: false, problem }
  }

  invalidateSessionScope()
  const store = useSessionStore()
  const idleTimeout = cachedSession(ctx.queryClient)?.idleTimeout ?? store.idleTimeout
  // UI 004 (research R10): a sign-out discards every kept form draft.
  clearAllDrafts()
  ctx.queryClient.clear()
  ctx.queryClient.setQueryData(queryKeys.session(), anonymousSession(idleTimeout))
  store.reset()
  store.notice = viaSingleSignOn ? 'signedOutSso' : 'signedOut'
  ctx.channel.post({ v: 1, type: 'signed-out' })
  await goToSignIn(ctx, null)
  clearCsrfToken()
  await refreshCsrfToken().catch(() => undefined)
  return { ok: true }
}

/** Sign-out for the shell: busy state, the failure and a retry. */
export function useSignOut(ctx?: SessionContext) {
  const pending = ref(false)
  const failed = shallowRef<ApiProblem | null>(null)

  async function run(): Promise<void> {
    if (pending.value) return
    pending.value = true
    failed.value = null
    try {
      const result = await signOut(ctx ?? sessionContext())
      if (!result.ok) failed.value = result.problem
    } finally {
      pending.value = false
    }
  }

  return { signOut: run, retry: run, pending, failed }
}

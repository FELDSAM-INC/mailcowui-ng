// UI007 R4: unmount the previous account before clearing its observers and data.
import { nextTick } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { problemOf, queryKeys, refreshCsrfToken, setCsrfToken, type Identity } from '@/api'
import { lt } from '@/i18n'
import { clearAllDrafts, setDraftOwner } from '@/shared/composables/draft-registry'
import { settleConfirm } from '@/shared/composables/useConfirm'
import { announce } from '@/shared/composables/useAnnouncer'
import { routeAccess } from '../router/guards'
import { focusPageHeading } from '../router/focus'
import { acceptReturnTo } from '../router/return-to'
import { sessionContext, type SessionContext } from './context'
import { identityQuery, sessionQuery } from './queries'
import { endSession } from './session-end'
import { useSessionStore } from './store'

export type IdentitySwitchReason =
  | 'actingStarted'
  | 'actingEnded'
  | 'actingEndedByServer'
  | 'changedInAnotherTab'
  | 'sessionReplaced'
  | 'selfRenamed'
export interface IdentitySwitch {
  reason: IdentitySwitchReason
  identity?: Identity
  csrfToken?: string
  refusedWrite?: boolean
}
let running: Promise<void> | null = null
let pending: {
  options: IdentitySwitch
  context: SessionContext
  origin: string | null
  current: string
} | null = null

export function switchIdentity(options: IdentitySwitch, context = sessionContext()): Promise<void> {
  if (running) return running
  const store = useSessionStore()
  const current = context.router.currentRoute.value.fullPath
  const origin = store.actingOrigin
  if (options.reason === 'actingStarted') store.actingOrigin = current
  else store.actingOrigin = null
  pending = { options, context, origin, current }
  running = run(pending).finally(() => {
    running = null
  })
  return running
}
export function retryIdentitySwitch(): Promise<void> {
  if (running) return running
  if (!pending) return Promise.resolve()
  // A retry rereads the current server state instead of reusing an earlier response's token.
  pending.options = { reason: pending.options.reason, refusedWrite: pending.options.refusedWrite }
  running = run(pending).finally(() => {
    running = null
  })
  return running
}
async function run(operation: NonNullable<typeof pending>): Promise<void> {
  const { options, context: ctx, origin, current } = operation
  const store = useSessionStore()
  store.identityTransition = true
  store.identityTransitionProblem = null
  store.shellNotice = null
  settleConfirm(false)
  await nextTick()
  await ctx.queryClient.cancelQueries()
  ctx.queryClient.getMutationCache().clear()
  ctx.queryClient.clear()
  clearAllDrafts()
  try {
    if (options.csrfToken) setCsrfToken(options.csrfToken)
    else await refreshCsrfToken()
    const identity =
      options.identity ?? (await ctx.queryClient.fetchQuery({ ...identityQuery(), retry: false }))
    ctx.queryClient.setQueryData(queryKeys.identity(), identity)
    setDraftOwner(identity.username)
    await ctx.queryClient.fetchQuery({ ...sessionQuery(), retry: false })
    if (options.reason !== 'changedInAnotherTab')
      ctx.channel.post({ v: 1, type: 'session-changed' })
    let target: RouteLocationRaw = { name: 'home' }
    if (options.reason === 'actingEnded' || options.reason === 'actingEndedByServer')
      target = origin ?? '/'
    else if (options.reason === 'changedInAnotherTab') target = current
    else if (options.reason === 'selfRenamed')
      target = { name: 'admin-detail', params: { username: identity.username } }
    else if (options.reason === 'sessionReplaced') {
      target =
        acceptReturnTo(ctx.router.currentRoute.value.query.returnTo, ctx.router) ??
        acceptReturnTo(store.returnTo, ctx.router) ??
        '/'
      store.returnTo = null
    }
    const resolved = ctx.router.resolve(target)
    if (!resolved.matched.length || routeAccess(resolved, identity) !== 'allowed')
      target = { name: 'home' }
    await ctx.router.replace(target)
    if (options.reason === 'changedInAnotherTab')
      store.shellNotice = {
        key: 'acting.notice.changedInAnotherTab',
        refusedWrite: options.refusedWrite,
      }
    else if (options.reason === 'actingEndedByServer')
      store.shellNotice = { key: 'acting.notice.endedByServer', refusedWrite: true }
    else if (options.reason === 'actingStarted' || options.reason === 'actingEnded')
      announce(lt('success.logged_in_as', identity.username))
    else if (options.reason === 'selfRenamed') announce(lt('success.admin_modified'))
    store.identityTransition = false
    pending = null
    // A same-route switch has no navigation focus event. The new view mounts only now.
    await nextTick()
    focusPageHeading()
  } catch (error) {
    const problem = problemOf(error)
    if (problem?.status === 401) {
      pending = null
      await endSession(ctx)
      store.identityTransition = false
    } else store.identityTransitionProblem = problem
  }
}

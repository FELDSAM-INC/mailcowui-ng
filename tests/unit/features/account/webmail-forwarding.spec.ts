import { describe, expect, it, vi } from 'vitest'

import { queryKeys, type Identity, type Session } from '@/api'
import type { LandingContext } from '@/app/session/landing'
import { fetchIdentity, fetchSession } from '@/app/session/queries'
import { forwardToWebmail } from '@/features/account/webmail-forwarding'

import { mockState, useScenario } from '../../../mocks/node'
import { testPlugins } from '../../support/mount'

async function setup() {
  useScenario('account-mailbox')
  mockState().mailboxes.find((item) => item.localPart === 'anna')!.webmailRedirect = true
  const queryClient = testPlugins().queryClient
  const identity = await fetchIdentity()
  const session = await fetchSession()
  queryClient.setQueryData(queryKeys.identity(), identity)
  queryClient.setQueryData(queryKeys.session(), session)
  const context: LandingContext = { intent: 'default', identity, session }
  return { context, queryClient, navigate: vi.fn() }
}

describe('webmail forwarding', () => {
  it('forwards the full mailbox default landing and leaves the fetched overview in the cache', async () => {
    const { context, queryClient, navigate } = await setup()
    expect(await forwardToWebmail(context, queryClient, navigate)).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/SOGo/so/')
    expect(queryClient.getQueryData(queryKeys.me.mailbox())).toBeDefined()
  })

  it.each([
    'requested',
    'admin',
    'restricted',
    'pending',
    'impersonated',
    'noIdentity',
    'disabled',
    'noRedirect',
  ])('does not forward %s', async (condition) => {
    const { context, queryClient, navigate } = await setup()
    if (condition === 'requested') context.intent = 'requested'
    if (condition === 'admin') context.session = { ...context.session, role: 'admin' }
    if (condition === 'restricted') context.session = { ...context.session, state: 'restricted' }
    if (condition === 'pending')
      context.session = { ...context.session, pendingActions: ['passwordChange'] }
    if (condition === 'impersonated')
      context.identity = {
        ...context.identity!,
        impersonation: {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          impersonator: { username: 'admin', role: 'admin', authMethod: 'password' },
          target: { username: 'anna@example.org', role: 'mailboxUser' },
          startedAt: '2026-10-20T10:00:00Z',
        },
      }
    if (condition === 'noIdentity') context.identity = undefined
    if (condition === 'disabled') mockState().selfService.groupwareEnabled = false
    if (condition === 'noRedirect')
      mockState().mailboxes.find((item) => item.localPart === 'anna')!.webmailRedirect = false
    expect(await forwardToWebmail(context, queryClient, navigate)).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('lets the landing controller handle hand-off failures and continue to home', async () => {
    const { context, queryClient, navigate } = await setup()
    mockState().failures.createWebmailHandOff = { status: 500 }
    await expect(forwardToWebmail(context, queryClient, navigate)).rejects.toBeDefined()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not forward after the session changed during the overview request', async () => {
    const { context, queryClient, navigate } = await setup()
    queryClient.setQueryData<Session>(queryKeys.session(), {
      ...context.session,
      state: 'anonymous',
    })
    queryClient.setQueryData<Identity>(queryKeys.identity(), {
      ...context.identity!,
      username: 'bob@example.org',
    })
    expect(await forwardToWebmail(context, queryClient, navigate)).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })
})

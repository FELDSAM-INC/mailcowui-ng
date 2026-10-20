import type { MailboxMailSettings, MailboxMailSettingsPatch, Writable } from '@/api'
import { addressOf } from '../../factories/mailbox'
import { mailSettingsEtag } from '../../factories/mail-settings'
import type { MockMailbox } from '../../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import { flagRefusal, outage, preconditionFailed, reachMailbox } from './rules'

export function mailSettingsView(mailbox: MockMailbox): MailboxMailSettings {
  return {
    mailbox: addressOf(mailbox),
    taggedMailHandling: mailbox.taggedMailHandling,
    tlsEnforceInbound: mailbox.tlsEnforceInbound,
    tlsEnforceOutbound: mailbox.tlsEnforceOutbound,
    etag: mailSettingsEtag(mailbox),
  }
}
export const mailSettingsHandlers = [
  http.get('/mailboxes/{mailbox}/mail-settings', ({ params, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = reachMailbox(state, account, params.mailbox)
    if (mailbox instanceof Response) return response.untyped(mailbox)
    const unavailable = outage(state, 'sharedStore')
    if (unavailable) return response.untyped(unavailable)
    const data = mailSettingsView(mailbox)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/mailboxes/{mailbox}/mail-settings', async ({ params, request, response }) => {
    const state = scenario()
    const csrf = csrfProblem(state, request)
    if (csrf) return response.untyped(csrf)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = reachMailbox(state, account, params.mailbox)
    if (mailbox instanceof Response) return response.untyped(mailbox)
    const unavailable = outage(state, 'sharedStore')
    if (unavailable) return response.untyped(unavailable)
    const stale = preconditionFailed(request, mailSettingsEtag(mailbox))
    if (stale) return response.untyped(stale)
    const patch = (await request.json()) as Writable<MailboxMailSettingsPatch>
    if (!Object.keys(patch).length)
      return response.untyped(
        problem(422, 'validation-failed', { errors: { body: [{ code: 'required' }] } }),
      )
    for (const key of ['taggedMailHandling', 'tlsEnforceInbound', 'tlsEnforceOutbound'] as const) {
      if (patch[key] !== undefined && patch[key] !== mailbox[key]) {
        const denied = flagRefusal(
          account,
          key === 'taggedMailHandling' ? 'delimiterAction' : 'tlsPolicy',
        )
        if (denied) return response.untyped(denied)
      }
    }
    Object.assign(mailbox, patch)
    const data = mailSettingsView(mailbox)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
]

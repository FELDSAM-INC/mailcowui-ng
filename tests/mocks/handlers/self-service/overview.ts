// The own mailbox overview (UI 005 T012) and, from US5 and US9, the webmail hand-off, the client
// configuration and the Apple profiles. Mailbox users with a full session only.
import { mailboxOverview } from '../../factories/mailbox-overview'
import { http, requireAccount, scenario } from '../context'
import { ownMailbox, untypedJson } from './rules'

export const overviewHandlers = [
  http.get('/me/mailbox', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = ownMailbox(state, account)
    if (mailbox instanceof Response) return response.untyped(mailbox)
    return response.untyped(untypedJson(200, { data: mailboxOverview(state, mailbox) }))
  }),
]

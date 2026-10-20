// The own mailbox overview (UI 005 T012) and, from US5 and US9, the webmail hand-off, the client
// configuration and the Apple profiles. Mailbox users with a full session only.
import { mailboxOverview } from '../../factories/mailbox-overview'
import { addressOf } from '../../factories/mailbox'
import { recentLogin } from '../../factories/recent-login'
import { mailboxSelfService } from '../../scenarios/self-service/state'
import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import { isoNow, ownMailbox, untypedJson } from './rules'

export const overviewHandlers = [
  http.get('/me/mailbox', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = ownMailbox(state, account)
    if (mailbox instanceof Response) return response.untyped(mailbox)
    return response.untyped(untypedJson(200, { data: mailboxOverview(state, mailbox) }))
  }),
  http.post('/me/webmail-handoff', ({ request, response }) => {
    const state = scenario()
    const csrf = csrfProblem(state, request)
    if (csrf) return response.untyped(csrf)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = ownMailbox(state, account)
    if (mailbox instanceof Response) return response.untyped(mailbox)
    if (!state.selfService.groupwareEnabled) {
      return response.untyped(problem(403, 'groupware-disabled'))
    }
    const address = addressOf(mailbox)
    mailboxSelfService(state, address).recentLogins.unshift(
      recentLogin({
        service: 'SSO',
        lastSeenAt: isoNow(state),
      }),
    )
    return response(200).json(
      { data: { mailbox: address, url: '/SOGo/so/' } },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': 'MCSESSID=mock-webmail-session; Path=/; HttpOnly; SameSite=Lax',
        },
      },
    )
  }),
]

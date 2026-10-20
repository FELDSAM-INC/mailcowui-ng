import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import { flagRefusal, reachMailbox } from './rules'

function reset(request: Request, mailbox: string, profile: boolean): Response | null {
  const state = scenario()
  const csrf = csrfProblem(state, request)
  if (csrf) return csrf
  const account = requireAccount(state)
  if (account instanceof Response) return account
  const reached = reachMailbox(state, account, mailbox)
  if (reached instanceof Response) return reached
  if (!state.selfService.groupwareEnabled) return problem(403, 'groupware-disabled')
  return flagRefusal(account, profile ? 'sogoProfileReset' : 'easReset')
}
export const groupwareHandlers = [
  http.delete('/mailboxes/{mailbox}/activesync-cache', ({ params, request, response }) => {
    const refused = reset(request, params.mailbox, false)
    return refused ? response.untyped(refused) : response(204).empty()
  }),
  http.delete('/mailboxes/{mailbox}/groupware-profile', ({ params, request, response }) => {
    const refused = reset(request, params.mailbox, true)
    return refused ? response.untyped(refused) : response(204).empty()
  }),
]

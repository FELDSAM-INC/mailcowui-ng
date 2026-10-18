// The read-only password policy (UI 003 T011): any signed-in account reads it, with its ETag. A
// `503` is injected through the scenario's failures (`getPasswordPolicy`), with `Retry-After`.
import { passwordPolicyView } from '../factories/password-policy'
import { http, requireAccount, scenario } from './context'

export const passwordPolicyHandlers = [
  http.get('/password-policy', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const data = passwordPolicyView(state.passwordPolicy)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
]

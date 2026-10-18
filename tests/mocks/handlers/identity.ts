// Identity handler (T026): `scope` and `permissions` come from the signed-in account.
import { http, requireAccount, scenario } from './context'

export const identityHandlers = [
  http.get('/me', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state, { allowRestricted: true })
    if (account instanceof Response) return response.untyped(account)
    return response(200).json({
      data: {
        username: account.username,
        role: account.role,
        authentication: { method: state.session.authMethod ?? 'password' },
        scope: account.scope,
        permissions: account.permissions,
        pendingActions: account.pendingActions,
        preferences: account.preferences,
      },
    })
  }),
]

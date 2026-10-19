// The routing capabilities (UI 009 T006, research R3): every value for administrators,
// `administration: null` for domain administrators, 403 forbidden for mailbox users.
import { http, scenario } from './context'
import { requireRoutingManager } from './routing-rules'

export const routingCapabilityHandlers = [
  http.get('/capabilities/routing', ({ response }) => {
    const state = scenario()
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const capabilities = state.routing.capabilities
    return response(200).json({
      data: account.role === 'admin' ? capabilities : { ...capabilities, administration: null },
    })
  }),
]

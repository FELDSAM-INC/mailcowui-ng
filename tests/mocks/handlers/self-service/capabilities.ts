// `getSelfServiceCapabilities` (UI 005 T012, research R4): signed out only `passwordReset`; a
// session or key every member, and a session also `account`. Restricted sessions may read it.
import type { SelfServiceCapabilities } from '@/api'

import { capabilityValues } from '../../scenarios/self-service/state'
import { accountSelfService } from '../../scenarios/self-service/state'
import { http, scenario, sessionAccount } from '../context'

export const capabilityHandlers = [
  http.get('/capabilities/self-service', ({ response }) => {
    const state = scenario()
    const passwordReset = {
      available: state.selfService.passwordResetAvailable,
      tokenLifetimeMinutes: state.selfService.tokenLifetimeMinutes,
    }
    const account =
      state.session.state === 'active' || state.session.state === 'restricted'
        ? sessionAccount(state)
        : undefined
    if (!account) return response(200).json({ data: { passwordReset } })
    const external =
      account.external || (account.source !== undefined && account.source !== 'mailcow')
    const data: SelfServiceCapabilities = {
      passwordReset,
      ...capabilityValues(state),
      account: {
        role: account.role,
        secondFactorRequired: accountSelfService(state, account.username).secondFactorRequired,
        passwordChangeAvailable: !external,
        secondFactorManagementAvailable: !external,
      },
    }
    return response(200).json({ data })
  }),
]

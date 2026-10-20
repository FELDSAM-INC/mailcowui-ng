import { http, problem, requireAccount, scenario } from './context'
function refused() {
  const state = scenario(),
    account = requireAccount(state)
  if (account instanceof Response) return account
  if (account.role !== 'admin') return problem(403, 'forbidden')
  return state.settings.capabilities.licenseVerificationEnabled
    ? null
    : problem(403, 'feature-disabled')
}
export const licenseHandlers = [
  http.get('/license', ({ response }) => {
    const denied = refused()
    if (denied) return response.untyped(denied)
    return response(200).json({ data: scenario().settings.license })
  }),
  http.post('/license/verification', ({ response }) => {
    const denied = refused()
    if (denied) return response.untyped(denied)
    const state = scenario().settings,
      valid = state.licenseResult === 'valid'
    state.license.lastVerification = {
      result: state.licenseResult,
      verifiedAt: new Date().toISOString(),
      customerId: valid ? 'customer-123' : null,
      serviceId: valid ? 'service-456' : null,
      supportLevel: valid ? 2 : null,
    }
    return response(200).json({ data: state.license })
  }),
]

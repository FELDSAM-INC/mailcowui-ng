// UI 003 reads this policy for any signed-in account; UI 013 lets only administrators update
// it with the same contract version tag. Demo mode leaves the readable policy unchanged.
import { passwordPolicyView } from '../factories/password-policy'
import { http, problem, requireAccount, scenario } from './context'

export const passwordPolicyHandlers = [
  http.get('/password-policy', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const data = passwordPolicyView(state.passwordPolicy)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/password-policy', async ({ request, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(problem(403, 'forbidden'))
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const current = passwordPolicyView(state.passwordPolicy)
    if (request.headers.get('if-match') !== current.etag)
      return response.untyped(problem(412, null))
    const body = await request.json()
    const { passwordPolicyMinLength: min, passwordPolicyMaxLength: max } =
      state.settings.capabilities.limits
    if (
      body.minLength !== undefined &&
      (!Number.isInteger(body.minLength) || body.minLength < min || body.minLength > max)
    ) {
      return response.untyped(
        problem(422, 'validation-failed', {
          errors: {
            minLength: [{ code: 'outOfRange', message: 'Out of range', params: { min, max } }],
          },
        }),
      )
    }
    Object.assign(state.passwordPolicy, body)
    const data = passwordPolicyView(state.passwordPolicy)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
]

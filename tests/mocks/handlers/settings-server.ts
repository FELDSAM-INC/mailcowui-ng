import { http, problem, requireAccount, scenario } from './context'

function requireAdmin() {
  const account = requireAccount(scenario())
  return account instanceof Response
    ? account
    : account.role !== 'admin'
      ? problem(403, 'forbidden')
      : null
}

export const settingsServerHandlers = [
  http.get('/capabilities/settings', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(problem(403, 'forbidden'))
    return response(200).json({ data: state.settings.capabilities })
  }),
  http.get('/settings/ip-check', ({ response }) => {
    const refused = requireAdmin()
    if (refused) return response.untyped(refused)
    const data = scenario().settings.ipCheck
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/settings/ip-check', async ({ request, response }) => {
    const refused = requireAdmin()
    if (refused) return response.untyped(refused)
    const state = scenario()
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const data = state.settings.ipCheck
    if (request.headers.get('if-match') !== data.etag) return response.untyped(problem(412, null))
    const body = await request.json()
    data.enabled = body.enabled
    const previous = data.etag
    do {
      data.etag = `"ip-check-${++state.settings.revision}"`
    } while (data.etag === previous)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
]

import { loginLinksState, publishLoginLinks } from '../scenarios/settings-login-links'
import { http, problem, scenario } from './context'
import { addViolation, requireAdmin, validationFailed, type Violations } from './domain-rules'

// Independent server validation; the UI additionally reserves %u for the signed-in URL.
function urlError(value: string): 'tooLong' | 'invalidFormat' | null {
  if ([...value].length > 2048) return 'tooLong'
  if (!value || /\s|[\u0000-\u001f\u007f]/u.test(value)) return 'invalidFormat'
  if (value.startsWith('/'))
    return value.startsWith('//') || value.startsWith('/\\') ? 'invalidFormat' : null
  try {
    const url = new URL(value.replaceAll('%u', 'user'))
    return /^https?:\/\//i.test(value) && url.hostname ? null : 'invalidFormat'
  } catch {
    return 'invalidFormat'
  }
}
export const settingsLoginLinksHandlers = [
  http.get('/settings/login-page', ({ response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const data = loginLinksState(state).login
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/settings/login-page', async ({ request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const store = loginLinksState(state)
    if (request.headers.get('if-match') !== store.login.etag)
      return response.untyped(problem(412, null))
    store.login = {
      ...store.login,
      ...(await request.json()),
      etag: `"login-page-${++store.revision}"`,
    }
    publishLoginLinks(state)
    return response(200).json({ data: store.login }, { headers: { ETag: store.login.etag } })
  }),
  http.get('/settings/app-links', ({ response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const data = loginLinksState(state).apps
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/settings/app-links', async ({ request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const store = loginLinksState(state)
    if (request.headers.get('if-match') !== store.apps.etag)
      return response.untyped(problem(412, null))
    const body = await request.json(),
      errors: Violations = {}
    if (body.links.length > 50) addViolation(errors, 'links', 'tooLong', { max: 50 })
    body.links.forEach((link, i) => {
      if (!link.name.trim()) addViolation(errors, `links.${i}.name`, 'required')
      else if ([...link.name].length > 255)
        addViolation(errors, `links.${i}.name`, 'tooLong', { max: 255 })
      else if (/[\u0000-\u001f\u007f]/.test(link.name))
        addViolation(errors, `links.${i}.name`, 'invalidFormat', { format: 'singleLine' })
      for (const field of ['url', 'signedInUrl'] as const) {
        const value = link[field]
        if (value === null) continue
        const error = urlError(value)
        if (error)
          addViolation(
            errors,
            `links.${i}.${field}`,
            error,
            error === 'tooLong' ? { max: 2048 } : { format: 'appLinkUrl' },
          )
      }
    })
    if (Object.keys(errors).length) return response.untyped(validationFailed(errors))
    store.apps = { ...store.apps, links: body.links, etag: `"app-links-${++store.revision}"` }
    publishLoginLinks(state)
    return response(200).json({ data: store.apps }, { headers: { ETag: store.apps.etag } })
  }),
]

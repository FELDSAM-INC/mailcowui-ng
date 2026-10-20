import { http, problem, requireAccount, scenario } from './context'
function requireAdmin() {
  const account = requireAccount(scenario())
  return account instanceof Response
    ? account
    : account.role !== 'admin'
      ? problem(403, 'forbidden')
      : null
}
export const settingsCorsHandlers = [
  http.get('/settings/legacy-api-cors', ({ response }) => {
    const denied = requireAdmin()
    if (denied) return response.untyped(denied)
    const data = scenario().settings.cors
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.patch('/settings/legacy-api-cors', async ({ request, response }) => {
    const denied = requireAdmin()
    if (denied) return response.untyped(denied)
    const state = scenario(),
      stored = state.settings.cors
    if (request.headers.get('if-match') !== stored.etag) return response.untyped(problem(412, null))
    const body = await request.json()
    const next = { ...stored, ...body }
    const errors: Record<
      string,
      { code: string; message: string; params?: Record<string, unknown> }[]
    > = {}
    if (next.allowedOrigins.length > state.settings.capabilities.limits.corsOriginsMax)
      errors.allowedOrigins = [
        {
          code: 'tooMany',
          message: 'Too many origins',
          params: { max: state.settings.capabilities.limits.corsOriginsMax },
        },
      ]
    next.allowedOrigins.forEach((value, index) => {
      let valid = value === '*'
      if (!valid)
        try {
          const url = new URL(value)
          valid =
            /^https?:\/\/[^/?#@\\\s]+$/i.test(value) &&
            !url.username &&
            !url.password &&
            /^[a-z0-9.:[\]-]+$/i.test(url.hostname)
        } catch {
          valid = false
        }
      if (!valid)
        errors[`allowedOrigins.${index}`] = [
          { code: 'invalidFormat', message: 'Invalid origin', params: { format: 'origin' } },
        ]
    })
    if (
      !next.allowedMethods.length ||
      next.allowedMethods.some((method) => !['POST', 'GET', 'DELETE', 'PUT'].includes(method))
    )
      errors.allowedMethods = [
        {
          code: 'notInList',
          message: 'Invalid method',
          params: { allowed: ['POST', 'GET', 'DELETE', 'PUT'] },
        },
      ]
    if (Object.keys(errors).length)
      return response.untyped(problem(422, 'validation-failed', { errors }))
    Object.assign(stored, next, {
      allowedOrigins: [...new Set(next.allowedOrigins.map((value) => value.toLowerCase()))],
      allowedMethods: [...new Set(next.allowedMethods)],
      etag: `"cors-${++state.settings.revision}"`,
    })
    return response(200).json({ data: stored }, { headers: { ETag: stored.etag } })
  }),
]

import { http, scenario, csrfProblem, problem } from './context'
import { requireAdmin } from './domain-rules'
function guard(request: Request, write = false) {
  return (write && csrfProblem(scenario(), request)) || requireAdmin(scenario())
}
export const globalFilterHandlers = [
  http.get('/settings/global-sieve-filters', ({ request, response }) => {
    const refused = guard(request)
    if (refused instanceof Response) return response.untyped(refused)
    return response(200).json({
      data: scenario().settings.globalFilters,
      meta: { total: 2, limit: 2, offset: 0 },
    })
  }),
  http.get('/settings/global-sieve-filters/{filterId}', ({ request, params, response }) => {
    const refused = guard(request)
    if (refused instanceof Response) return response.untyped(refused)
    const data = scenario().settings.globalFilters.find((filter) => filter.id === params.filterId)!
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
  http.put('/settings/global-sieve-filters/{filterId}', async ({ request, params, response }) => {
    const refused = guard(request, true)
    if (refused instanceof Response) return response.untyped(refused)
    const state = scenario().settings
    const data = state.globalFilters.find((filter) => filter.id === params.filterId)!
    if (state.missingGlobalFilters.includes(data.id))
      return response.untyped(problem(409, 'global-sieve-filter-unavailable'))
    if (request.headers.get('if-match') !== data.etag) return response.untyped(problem(412, null))
    const body = await request.json()
    const script = body.script.replace(/\r\n?/g, '\n')
    if (new TextEncoder().encode(script).byteLength > state.capabilities.limits.sieveScriptMaxBytes)
      return response.untyped(
        problem(422, 'validation-failed', {
          errors: {
            script: [
              {
                code: 'tooLong',
                message: 'Too long',
                params: { max: state.capabilities.limits.sieveScriptMaxBytes, unit: 'bytes' },
              },
            ],
          },
        }),
      )
    // Deliberately narrow syntax fixture; production uses the API's Sieve parser.
    const invalidLine = script.split('\n').findIndex((line) => /^\s*keep\s*$/.test(line))
    if (invalidLine >= 0)
      return response.untyped(
        problem(422, 'validation-failed', {
          errors: {
            script: [
              {
                code: 'sieveSyntax',
                message: 'Invalid Sieve',
                params: { line: invalidLine + 1, message: 'Expected semicolon after keep' },
              },
            ],
          },
        }),
      )
    if (new URL(request.url).searchParams.get('validateOnly') === 'true')
      return response(200).json({ data: { valid: true } })
    data.script = script
    data.etag = `"global-${data.id}-${++state.revision}"`
    const outcome = body.deferRestart ? 'deferred' : state.globalRestart
    if (!body.deferRestart) state.restartCount++
    return response(200).json(
      {
        data,
        meta: {
          dovecotRestart: {
            outcome,
            detail: outcome === 'failed' ? 'Container service unavailable' : null,
          },
        },
      },
      { headers: { ETag: data.etag } },
    )
  }),
]

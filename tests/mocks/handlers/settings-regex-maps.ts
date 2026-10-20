import { regexLineMarks } from '@/features/system-settings/lib/regex-lines'
import { http, problem, requireAccount, scenario } from './context'
function guard() {
  const account = requireAccount(scenario())
  return account instanceof Response
    ? account
    : account.role !== 'admin'
      ? problem(403, 'forbidden')
      : null
}
export const regexMapHandlers = [
  http.get('/settings/rspamd-regex-maps', ({ request, response }) => {
    const refused = guard()
    if (refused) return response.untyped(refused)
    const params = new URL(request.url).searchParams
    const q = (params.get('q') ?? '').trim().toLowerCase()
    let rows = scenario().settings.regexMaps.filter(
      (row) => row.name.toLowerCase().includes(q) || row.id.includes(q),
    )
    const sort = params.get('sort')
    if (sort === 'name' || sort === 'id')
      rows = [...rows].sort(
        (a, b) => a[sort].localeCompare(b[sort]) * (params.get('order') === 'desc' ? -1 : 1),
      )
    const total = rows.length,
      limit = Number(params.get('limit') ?? 25),
      offset = Number(params.get('offset') ?? 0)
    const data = rows.slice(offset, offset + limit).map(({ content, ...row }) => ({
      ...row,
      sizeBytes: new TextEncoder().encode(content).byteLength,
    }))
    return response(200).json({ data, meta: { total, limit, offset } })
  }),
  http.get('/settings/rspamd-regex-maps/{mapId}', ({ params, response }) => {
    const refused = guard()
    if (refused) return response.untyped(refused)
    const data = scenario().settings.regexMaps.find((row) => row.id === params.mapId)
    return data
      ? response(200).json({ data }, { headers: { ETag: data.etag } })
      : response.untyped(problem(404, null))
  }),
  http.put('/settings/rspamd-regex-maps/{mapId}', async ({ params, request, response }) => {
    const refused = guard()
    if (refused) return response.untyped(refused)
    const state = scenario(),
      data = state.settings.regexMaps.find((row) => row.id === params.mapId)
    if (!data) return response.untyped(problem(404, null))
    if (!data.available)
      return response.untyped(problem(409, 'regex-map-unavailable', { mapId: data.id }))
    if (request.headers.get('if-match') !== data.etag) return response.untyped(problem(412, null))
    const { content } = await request.json()
    const mark = regexLineMarks(content)[0]
    let invalid: { line: number; reason: string } | undefined = mark
    if (!invalid)
      for (const [index, line] of content.split('\n').entries()) {
        if (!line.startsWith('/')) continue
        try {
          new RegExp(
            line.slice(1, line.lastIndexOf('/')),
            line.slice(line.lastIndexOf('/') + 1).replace(/\r$/, ''),
          )
        } catch {
          invalid = { line: index + 1, reason: 'doesNotCompile' }
          break
        }
      }
    if (invalid)
      return response.untyped(
        problem(422, 'validation-failed', {
          errors: {
            content: [{ code: 'invalidRegexLine', message: 'Invalid regex line', params: invalid }],
          },
        }),
      )
    if (
      new TextEncoder().encode(content).byteLength >
      state.settings.capabilities.limits.rspamdRegexMapMaxBytes
    )
      return response.untyped(
        problem(422, 'validation-failed', {
          errors: {
            content: [
              {
                code: 'tooLong',
                message: 'Too long',
                params: {
                  max: state.settings.capabilities.limits.rspamdRegexMapMaxBytes,
                  unit: 'bytes',
                },
              },
            ],
          },
        }),
      )
    if (new URL(request.url).searchParams.get('validateOnly') === 'true')
      return response(200).json({ data: { valid: true } })
    data.content = content.trim() + '\n'
    data.etag = `"map-${data.id}-${++state.settings.revision}"`
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
]

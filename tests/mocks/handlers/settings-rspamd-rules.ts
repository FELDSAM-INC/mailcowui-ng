import type { RspamdSettingsRulePatch } from '@/api'
import { utf8ByteLength } from '@/shared/validation/utf8'
import { checkUcl } from '../factories/ucl-structure'
import { rspamdRuleState } from '../scenarios/settings-rspamd-rules'
import { csrfProblem, http, scenario } from './context'
import {
  addViolation,
  compareValues,
  notFound,
  outdated,
  page,
  requireAdmin,
  validationFailed,
  type Violations,
} from './domain-rules'
function access(request: Request, write = false) {
  const state = scenario()
  return (write && csrfProblem(state, request)) || requireAdmin(state)
}
function validate(body: RspamdSettingsRulePatch, create = false) {
  const errors: Violations = {}
  if ((create || body.description !== undefined) && !body.description?.trim())
    addViolation(errors, 'description', 'required')
  if ((body.description?.length ?? 0) > 255)
    addViolation(errors, 'description', 'tooLong', { limit: 255 })
  if (create || body.content !== undefined) {
    if (!body.content?.trim()) addViolation(errors, 'content', 'required')
    else if (utf8ByteLength(body.content) > 1_048_576)
      addViolation(errors, 'content', 'tooLong', { limit: 1_048_576, unit: 'bytes' })
    else {
      const structural = checkUcl(body.content)
      if (structural) addViolation(errors, 'content', 'unbalancedStructure', structural)
    }
  }
  return Object.keys(errors).length ? validationFailed(errors) : null
}
function version(id: number) {
  return `"rule-${id}-${++rspamdRuleState(scenario()).revision}"`
}
function current(id: number, request: Request) {
  const store = rspamdRuleState(scenario())
  const item = store.rules.find((rule) => rule.id === id)
  if (!item) return notFound()
  if (store.outdatedOnce) {
    store.outdatedOnce = false
    item.description = 'Changed by another administrator'
    item.etag = version(item.id)
  }
  return request.headers.get('If-Match') === item.etag ? item : outdated()
}
export const rspamdRulesHandlers = [
  http.get('/settings/rspamd-rules', ({ request, response }) => {
    const account = access(request)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url),
      q = url.searchParams.get('q')?.toLowerCase(),
      active = url.searchParams.get('active')
    const sort = (url.searchParams.get('sort') ?? 'id') as
      'id' | 'description' | 'active' | 'createdAt' | 'modifiedAt'
    const direction = url.searchParams.get('order') === 'desc' ? -1 : 1
    const rows = rspamdRuleState(scenario()).rules.filter(
      (rule) =>
        (!q || `${rule.description} ${rule.content}`.toLowerCase().includes(q)) &&
        (active === null || rule.active === (active === 'true')),
    )
    rows.sort((a, b) => compareValues(a[sort], b[sort]) * direction || a.id - b.id)
    return response(200).json(page(rows, url))
  }),
  http.get('/settings/rspamd-rules/{ruleId}', ({ request, params, response }) => {
    const account = access(request)
    if (account instanceof Response) return response.untyped(account)
    const item = rspamdRuleState(scenario()).rules.find((rule) => rule.id === Number(params.ruleId))
    return item
      ? response(200).json({ data: item }, { headers: { ETag: item.etag } })
      : response.untyped(notFound())
  }),
  http.post('/settings/rspamd-rules', async ({ request, response }) => {
    const account = access(request, true)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const invalid = validate(body, true)
    if (invalid) return response.untyped(invalid)
    if (new URL(request.url).searchParams.get('validateOnly') === 'true')
      return response(200).json({ data: { valid: true } })
    const store = rspamdRuleState(scenario())
    const id = store.nextId++
    const item = {
      id,
      description: body.description,
      content: body.content.trim(),
      active: body.active ?? false,
      createdAt: new Date(scenario().now()).toISOString(),
      modifiedAt: null,
      etag: version(id),
    }
    store.rules.push(item)
    return response(201).json(
      { data: item },
      { headers: { ETag: item.etag, Location: `/api/v2/settings/rspamd-rules/${item.id}` } },
    )
  }),
  http.patch('/settings/rspamd-rules/{ruleId}', async ({ request, params, response }) => {
    const account = access(request, true)
    if (account instanceof Response) return response.untyped(account)
    const item = current(Number(params.ruleId), request)
    if (item instanceof Response) return response.untyped(item)
    const body = await request.json()
    const invalid = validate(body)
    if (invalid) return response.untyped(invalid)
    if (new URL(request.url).searchParams.get('validateOnly') === 'true')
      return response(200).json({ data: { valid: true } })
    Object.assign(item, body, body.content === undefined ? {} : { content: body.content.trim() }, {
      modifiedAt: new Date(scenario().now()).toISOString(),
      etag: version(item.id),
    })
    return response(200).json({ data: item }, { headers: { ETag: item.etag } })
  }),
  http.delete('/settings/rspamd-rules/{ruleId}', ({ request, params, response }) => {
    const account = access(request, true)
    if (account instanceof Response) return response.untyped(account)
    const item = current(Number(params.ruleId), request)
    if (item instanceof Response) return response.untyped(item)
    const store = rspamdRuleState(scenario())
    store.rules = store.rules.filter((rule) => rule.id !== item.id)
    return response(204).empty()
  }),
  http.get('/settings/rspamd-settings-map', ({ request, response }) => {
    const account = access(request)
    if (account instanceof Response) return response.untyped(account)
    return response(200).json({
      data: {
        content:
          '# Generated mailcow settings map\n' +
          rspamdRuleState(scenario())
            .rules.filter((rule) => rule.active)
            .map((rule) => `additional_settings_${rule.id} {\n${rule.content}\n}\n`)
            .join(''),
      },
    })
  }),
]

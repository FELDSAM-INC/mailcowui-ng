// Domain template handlers (UI 002 T010, research D28): list, search and sort; create with the
// legacy defaults; the domain value rules; a unique name ignoring letter case
// (`domain-template-name-exists`); the protected Default template (`domain-template-protected`);
// If-Match and 412.

import type { BulkItemResult } from '@/api'

import { MIB as UNIT, normaliseTags } from '../factories/domain'
import {
  isDefaultTemplate,
  mockTemplate,
  templateEtag,
  templateView,
} from '../factories/domain-template'
import type { MockDomainTemplate, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  checkQuotas,
  compareValues,
  normaliseRelay,
  notFound,
  outdated,
  page,
  requireAdmin,
  sameTags,
  validationFailed,
  type Violations,
} from './domain-rules'

const SORT_VALUE: Record<string, (template: MockDomainTemplate) => unknown> = {
  name: (t) => t.name,
  id: (t) => t.id,
  createdAt: (t) => t.createdAt,
  modifiedAt: (t) => t.modifiedAt,
}

const nameTaken = (state: ScenarioState, name: string, except?: number) =>
  state.domainTemplates.some(
    (template) =>
      template.id !== except && template.name.toLowerCase() === name.trim().toLowerCase(),
  )

function checkValues(
  errors: Violations,
  state: ScenarioState,
  values: MockDomainTemplate,
  sent: Partial<MockDomainTemplate>,
  currentTags: string[] = [],
): void {
  checkQuotas(errors, values, sent)
  const limit = state.domainCapabilities.taggingLimit
  if (
    sent.tags !== undefined &&
    values.tags.length > limit &&
    !(values.tags.length < currentTags.length) &&
    !sameTags(values.tags, currentTags)
  ) {
    addViolation(errors, 'tags', 'tooMany', { max: limit })
  }
}

const READ_ONLY = ['id', 'isDefault', 'createdAt', 'modifiedAt', 'etag'] as const

export const domainTemplateHandlers = [
  http.get('/domain-templates', ({ request, response }) => {
    const state = scenario()
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    let items = [...state.domainTemplates]
    const q = url.searchParams.get('q')?.toLowerCase()
    if (q) items = items.filter((template) => template.name.toLowerCase().includes(q))
    const value = SORT_VALUE[url.searchParams.get('sort') ?? 'name'] ?? SORT_VALUE.name!
    const direction = url.searchParams.get('order') === 'desc' ? -1 : 1
    items.sort((a, b) => direction * compareValues(value(a), value(b)) || a.id - b.id)
    const result = page(items, url)
    return response(200).json({ data: result.data.map(templateView), meta: result.meta })
  }),

  http.post('/domain-templates', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const errors: Violations = {}
    if (body.name.trim() === '') addViolation(errors, 'name', 'required')
    const id = Math.max(0, ...state.domainTemplates.map((template) => template.id)) + 1
    const now = new Date(state.now()).toISOString()
    // The generated type marks the members with a `default` keyword as required (openapi-typescript
    // `defaultNonNullable`); a client may still omit them, and they get the defaults.
    const { tags, ...rest }: Partial<typeof body> = body
    const values = mockTemplate({
      ...normaliseRelay({
        backupMx: false,
        relayAllRecipients: false,
        relayUnknownOnly: false,
        ...rest,
      }),
      id,
      name: body.name.trim(),
      tags: normaliseTags(tags ?? []),
      dkimSelector: body.dkimSelector ?? state.domainCapabilities.dkim?.defaultSelector ?? 'dkim',
      createdAt: now,
      modifiedAt: null,
    })
    checkValues(errors, state, values, body)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (nameTaken(state, body.name)) {
      return response.untyped(problem(409, 'domain-template-name-exists'))
    }
    state.domainTemplates.push(values)
    const data = templateView(values)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/domain-templates/${id}`, ETag: data.etag } },
    )
  }),

  http.get('/domain-templates/{templateId}', ({ params, response }) => {
    const state = scenario()
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const template = state.domainTemplates.find((item) => item.id === Number(params.templateId))
    if (!template) return response.untyped(notFound())
    const data = templateView(template)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/domain-templates/{templateId}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const template = state.domainTemplates.find((item) => item.id === Number(params.templateId))
    if (!template) return response.untyped(notFound())
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== templateEtag(template)) return response.untyped(outdated())
    const body = await request.json()
    const errors: Violations = {}
    const current = templateView(template) as unknown as Record<string, unknown>
    for (const key of READ_ONLY) {
      if (key in body && JSON.stringify(body[key]) !== JSON.stringify(current[key])) {
        addViolation(errors, key, 'immutable')
      }
    }
    if (body.name !== undefined && body.name.trim() === '') addViolation(errors, 'name', 'required')
    const { id: _id, isDefault: _d, createdAt: _c, modifiedAt: _m, etag: _e, tags, ...rest } = body
    const next: MockDomainTemplate = {
      ...template,
      ...normaliseRelay({ ...template, ...rest }),
      name: body.name?.trim() ?? template.name,
      tags: tags ? normaliseTags(tags) : template.tags,
    }
    checkValues(errors, state, next, body, template.tags)
    for (const key of ['maxMailboxQuota', 'domainQuota'] as const) {
      if (body[key] !== undefined && body[key] % UNIT !== 0 && !errors[key]) {
        addViolation(errors, key, 'notMultipleOf', { factor: UNIT })
      }
    }
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (isDefaultTemplate(template) && next.name !== template.name) {
      return response.untyped(problem(409, 'domain-template-protected'))
    }
    if (nameTaken(state, next.name, template.id)) {
      return response.untyped(problem(409, 'domain-template-name-exists'))
    }
    const before = templateEtag(template)
    Object.assign(template, next)
    if (templateEtag(template) !== before) template.modifiedAt = new Date(state.now()).toISOString()
    const data = templateView(template)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.delete('/domain-templates/{templateId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const template = state.domainTemplates.find((item) => item.id === Number(params.templateId))
    if (!template) return response.untyped(notFound())
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== templateEtag(template)) return response.untyped(outdated())
    if (isDefaultTemplate(template))
      return response.untyped(problem(409, 'domain-template-protected'))
    state.domainTemplates = state.domainTemplates.filter((item) => item.id !== template.id)
    return response(204).empty()
  }),

  http.post('/domain-templates/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    if (body.targets.length > 100) {
      const errors: Violations = {}
      addViolation(errors, 'targets', 'tooMany', { max: 100 })
      return response.untyped(validationFailed(errors))
    }
    const seen = new Set<number>()
    const results: BulkItemResult[] = []
    const itemProblem = async (answer: Response) =>
      (await answer.json()) as BulkItemResult['problem']
    for (const target of body.targets) {
      const id = Number(target.id)
      const template = Number.isInteger(id)
        ? state.domainTemplates.find((item) => item.id === id)
        : undefined
      if (seen.has(id)) continue
      seen.add(id)
      if (!template) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      if (
        target.version !== undefined &&
        target.version.replaceAll('"', '') !== templateEtag(template).replaceAll('"', '')
      ) {
        results.push({ id: target.id, outcome: 'outdated', problem: await itemProblem(outdated()) })
        continue
      }
      if (isDefaultTemplate(template)) {
        results.push({
          id: target.id,
          outcome: 'refused',
          problem: await itemProblem(problem(409, 'domain-template-protected')),
        })
        continue
      }
      state.domainTemplates = state.domainTemplates.filter((item) => item.id !== template.id)
      results.push({ id: target.id, outcome: 'done' })
    }
    const count = (outcome: BulkItemResult['outcome']) =>
      results.filter((item) => item.outcome === outcome).length
    return response(200).json({
      data: {
        bulkRequestId: Buffer.from(String(state.now()))
          .toString('hex')
          .padEnd(32, '0')
          .slice(0, 32),
        results,
        summary: {
          total: results.length,
          done: count('done'),
          notFound: count('notFound'),
          refused: count('refused'),
          outdated: count('outdated'),
          failed: count('failed'),
        },
      },
    })
  }),
]

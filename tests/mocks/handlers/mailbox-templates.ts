// Mailbox templates (UI 003 T011, US7 T102): the list with the name search, sort and paging, and
// one template with its ETag. Domain administrators read them without the user permissions their
// flags do not allow. US7 (T102) adds the writes: the defaults of `templateDefaults` for omitted
// values, case-insensitive unique names, the protected Default template, If-Match with 412,
// administrators only, and the bulk removal (G39) with per-item outcomes.
import type { BulkItemResult } from '@/api'

import { normaliseTags } from '../factories/domain'
import { defaultUserPermissions } from '../factories/mailbox'
import {
  isDefaultMailboxTemplate,
  mailboxTemplateEtag,
  mailboxTemplateView,
  mockMailboxTemplate,
} from '../factories/mailbox-template'
import type { MockMailboxTemplate, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  compareValues,
  notFound,
  outdated,
  page,
  requireAdmin,
  requireManager,
  validationFailed,
  type Violations,
} from './domain-rules'
import { bareVersion, bulkRequestId, checkTagLimit, mailboxFailure } from './mailbox-rules'

const SORT_VALUE: Record<string, (template: MockMailboxTemplate) => unknown> = {
  name: (t) => t.name,
  id: (t) => t.id,
  createdAt: (t) => t.createdAt,
  modifiedAt: (t) => t.modifiedAt,
}

export const mailboxTemplateReadHandlers = [
  http.get('/mailbox-templates', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase()
    let items = [...state.mailboxTemplates]
    if (q) items = items.filter((template) => template.name.toLowerCase().includes(q))
    const sort = url.searchParams.get('sort') ?? 'name'
    const direction = url.searchParams.get('order') === 'desc' ? -1 : 1
    const value = SORT_VALUE[sort] ?? SORT_VALUE.name!
    items.sort((a, b) => direction * compareValues(value(a), value(b)) || a.id - b.id)
    const result = page(items, url)
    return response(200).json({
      data: result.data.map((template) => mailboxTemplateView(template, account)),
      meta: result.meta,
    } as never)
  }),

  http.get('/mailbox-templates/{mailboxTemplateId}', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const template = state.mailboxTemplates.find(
      (item) => item.id === Number(params.mailboxTemplateId),
    )
    if (!template) return response.untyped(notFound())
    const data = mailboxTemplateView(template, account)
    return response(200).json({ data } as never, { headers: { ETag: data.etag } })
  }),
]

const isDefault = (template: MockMailboxTemplate) => isDefaultMailboxTemplate(template)

const nameTaken = (state: ScenarioState, name: string, except?: number) =>
  state.mailboxTemplates.some(
    (template) =>
      template.id !== except && template.name.toLowerCase() === name.trim().toLowerCase(),
  )

type TemplateBody = Partial<
  Omit<
    MockMailboxTemplate,
    'id' | 'createdAt' | 'modifiedAt' | 'protocolAccess' | 'userPermissions'
  >
> & {
  name?: string
  protocolAccess?: Partial<MockMailboxTemplate['protocolAccess']>
  userPermissions?: Partial<MockMailboxTemplate['userPermissions']>
}

/** The value rules of the template operations (name, tags, the rate limit). */
function checkTemplate(
  state: ScenarioState,
  errors: Violations,
  body: TemplateBody,
  current: string[] = [],
) {
  if (body.name !== undefined && body.name.trim() === '') addViolation(errors, 'name', 'required')
  if (body.tags !== undefined) {
    checkTagLimit(errors, state.mailboxCapabilities.taggingLimit, normaliseTags(body.tags), current)
  }
}

/** A stored template with the members of a create or merge-patch body applied. */
function apply(template: MockMailboxTemplate, body: TemplateBody): MockMailboxTemplate {
  const { protocolAccess, userPermissions, tags, name, ...rest } = body
  return {
    ...template,
    ...rest,
    name: name !== undefined ? name.trim() : template.name,
    tags: tags !== undefined ? normaliseTags(tags) : template.tags,
    protocolAccess: { ...template.protocolAccess, ...protocolAccess },
    userPermissions: { ...template.userPermissions, ...userPermissions },
  }
}

export const mailboxTemplateWriteHandlers = [
  http.post('/mailbox-templates', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = (await request.json()) as TemplateBody & { name: string }
    const errors: Violations = {}
    checkTemplate(state, errors, body)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (nameTaken(state, body.name)) {
      return response.untyped(problem(409, 'mailbox-template-name-exists'))
    }
    const failure = mailboxFailure(state, 'template:new', 'createMailboxTemplate')
    if (failure) return response.untyped(failure)
    const id = Math.max(0, ...state.mailboxTemplates.map((template) => template.id)) + 1
    const defaults = state.mailboxCapabilities.templateDefaults
    const template = apply(
      mockMailboxTemplate({
        ...defaults,
        userPermissions: { ...defaultUserPermissions(), ...defaults.userPermissions },
        id,
        name: body.name,
        createdAt: new Date(state.now()).toISOString(),
        modifiedAt: null,
      }),
      body,
    )
    state.mailboxTemplates.push(template)
    const data = mailboxTemplateView(template, account)
    return response(201).json({ data } as never, {
      headers: { Location: `/api/v2/mailbox-templates/${id}`, ETag: data.etag },
    })
  }),

  http.patch('/mailbox-templates/{mailboxTemplateId}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const template = state.mailboxTemplates.find(
      (item) => item.id === Number(params.mailboxTemplateId),
    )
    if (!template) return response.untyped(notFound())
    const failure = mailboxFailure(state, `template:${template.id}`, 'updateMailboxTemplate')
    if (failure) return response.untyped(failure)
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== mailboxTemplateEtag(template)) {
      return response.untyped(outdated())
    }
    const body = (await request.json()) as TemplateBody
    const errors: Violations = {}
    checkTemplate(state, errors, body, template.tags)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const next = apply(template, body)
    if (isDefault(template) && next.name !== template.name) {
      return response.untyped(problem(409, 'mailbox-template-protected'))
    }
    if (nameTaken(state, next.name, template.id)) {
      return response.untyped(problem(409, 'mailbox-template-name-exists'))
    }
    const before = mailboxTemplateEtag(template)
    Object.assign(template, next)
    if (mailboxTemplateEtag(template) !== before) {
      template.modifiedAt = new Date(state.now()).toISOString()
    }
    const data = mailboxTemplateView(template, account)
    return response(200).json({ data } as never, { headers: { ETag: data.etag } })
  }),

  http.delete('/mailbox-templates/{mailboxTemplateId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const template = state.mailboxTemplates.find(
      (item) => item.id === Number(params.mailboxTemplateId),
    )
    if (!template) return response.untyped(notFound())
    const failure = mailboxFailure(state, `template:${template.id}`, 'deleteMailboxTemplate')
    if (failure) return response.untyped(failure)
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== mailboxTemplateEtag(template)) {
      return response.untyped(outdated())
    }
    if (isDefault(template)) return response.untyped(problem(409, 'mailbox-template-protected'))
    state.mailboxTemplates = state.mailboxTemplates.filter((item) => item.id !== template.id)
    return response(204).empty()
  }),

  http.post('/mailbox-templates/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    // The contract caps the targets at 100 (`maxItems`), which the validator enforces.
    const body = await request.json()
    const seen = new Set<string>()
    const results: BulkItemResult[] = []
    const itemProblem = async (answer: Response) =>
      (await answer.json()) as BulkItemResult['problem']
    for (const target of body.targets) {
      const id = Number(target.id)
      const key = Number.isInteger(id) ? String(id) : target.id
      if (seen.has(key)) continue
      seen.add(key)
      const template = Number.isInteger(id)
        ? state.mailboxTemplates.find((item) => item.id === id)
        : undefined
      if (!template) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      const failure = mailboxFailure(
        state,
        `template:${template.id}`,
        'applyMailboxTemplateBulkAction',
      )
      if (failure) {
        results.push({ id: target.id, outcome: 'failed', problem: await itemProblem(failure) })
        continue
      }
      if (
        target.version !== undefined &&
        bareVersion(target.version) !== bareVersion(mailboxTemplateEtag(template))
      ) {
        results.push({ id: target.id, outcome: 'outdated', problem: await itemProblem(outdated()) })
        continue
      }
      if (isDefault(template)) {
        results.push({
          id: target.id,
          outcome: 'refused',
          problem: await itemProblem(problem(409, 'mailbox-template-protected')),
        })
        continue
      }
      state.mailboxTemplates = state.mailboxTemplates.filter((item) => item.id !== template.id)
      results.push({ id: target.id, outcome: 'done' })
    }
    const count = (outcome: BulkItemResult['outcome']) =>
      results.filter((item) => item.outcome === outcome).length
    return response(200).json({
      data: {
        bulkRequestId: bulkRequestId(state),
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

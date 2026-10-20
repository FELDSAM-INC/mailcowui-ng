// UI 005 US4: contract-validated app passwords, with mailbox scope, permission flags and ETags.
import type { AppPasswordCreateRequest, AppPasswordPatch, Writable } from '@/api'
import {
  appPasswordEtag,
  appPasswordView,
  generatedAppPassword,
  mockAppPassword,
} from '../../factories/app-password'
import { mailboxSelfService } from '../../scenarios/self-service/state'
import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import {
  addViolation,
  compareValues,
  page,
  validationFailed,
  type Violations,
} from '../domain-rules'
import { flagRefusal, isoNow, notFound, preconditionFailed, reachMailbox } from './rules'

function scope(mailbox: string, request: Request, change: boolean) {
  const state = scenario()
  if (change) {
    const csrf = csrfProblem(state, request)
    if (csrf) return csrf
  }
  const account = requireAccount(state)
  if (account instanceof Response) return account
  const reached = reachMailbox(state, account, mailbox)
  if (reached instanceof Response) return reached
  if (change) {
    const flag = flagRefusal(account, 'appPasswds')
    if (flag) return flag
  }
  return mailboxSelfService(state, mailbox.toLowerCase())
}
function validate(
  body: Writable<AppPasswordCreateRequest> | Writable<AppPasswordPatch>,
  create: boolean,
) {
  const errors: Violations = {}
  if (create || body.name !== undefined) {
    if (!body.name?.trim()) addViolation(errors, 'name', 'required')
    const stored = (body.name ?? '')
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
    if (stored.length > 255) addViolation(errors, 'name', 'tooLong', { limit: 255, stored: true })
  }
  if ('generatePassword' in body && body.generatePassword && body.password !== undefined)
    addViolation(errors, 'body', 'mutuallyExclusive', { fields: ['password', 'generatePassword'] })
  return Object.keys(errors).length ? validationFailed(errors) : null
}

export const appPasswordHandlers = [
  http.get('/mailboxes/{mailbox}/app-passwords', ({ params, request, response }) => {
    const record = scope(params.mailbox, request, false)
    if (record instanceof Response) return response.untyped(record)
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const active = url.searchParams.get('active')
    const sort = (url.searchParams.get('sort') ?? 'name') as
      'name' | 'createdAt' | 'modifiedAt' | 'active'
    const desc = url.searchParams.get('order') === 'desc'
    const items = record.appPasswords
      .filter(
        (item) =>
          (!q || item.name.toLowerCase().includes(q)) &&
          (active === null || item.active === (active === 'true')),
      )
      .map((item) => appPasswordView(params.mailbox, item))
    items.sort((a, b) => compareValues(a[sort], b[sort]) * (desc ? -1 : 1) || a.id - b.id)
    return response(200).json(page(items, url))
  }),
  http.post('/mailboxes/{mailbox}/app-passwords', async ({ params, request, response }) => {
    const record = scope(params.mailbox, request, true)
    if (record instanceof Response) return response.untyped(record)
    const body = (await request.json()) as Writable<AppPasswordCreateRequest>
    const invalid = validate(body, true)
    if (invalid) return response.untyped(invalid)
    const state = scenario()
    const item = mockAppPassword({
      id: ++state.selfService.nextAppPasswordId,
      name: body.name.trim(),
      active: body.active ?? true,
      ...(body.protocols ? { protocols: [...body.protocols] } : {}),
      createdAt: isoNow(state),
    })
    record.appPasswords.push(item)
    return response(201).json(
      {
        data: {
          ...appPasswordView(params.mailbox, item),
          generatedPassword: body.password === undefined ? generatedAppPassword(item.id) : null,
        },
      },
      {
        headers: {
          ETag: appPasswordEtag(params.mailbox, item),
          Location: `/api/v2/mailboxes/${encodeURIComponent(params.mailbox)}/app-passwords/${item.id}`,
        },
      },
    )
  }),
  http.get(
    '/mailboxes/{mailbox}/app-passwords/{appPasswordId}',
    ({ params, request, response }) => {
      const record = scope(params.mailbox, request, false)
      if (record instanceof Response) return response.untyped(record)
      const item = record.appPasswords.find((item) => item.id === Number(params.appPasswordId))
      if (!item) return response.untyped(notFound())
      return response(200).json(
        { data: appPasswordView(params.mailbox, item) },
        { headers: { ETag: appPasswordEtag(params.mailbox, item) } },
      )
    },
  ),
  http.patch(
    '/mailboxes/{mailbox}/app-passwords/{appPasswordId}',
    async ({ params, request, response }) => {
      const record = scope(params.mailbox, request, true)
      if (record instanceof Response) return response.untyped(record)
      const item = record.appPasswords.find((item) => item.id === Number(params.appPasswordId))
      if (!item) return response.untyped(notFound())
      const stale = preconditionFailed(request, appPasswordEtag(params.mailbox, item))
      if (stale) return response.untyped(stale)
      const body = (await request.json()) as Writable<AppPasswordPatch>
      const invalid = validate(body, false)
      if (invalid) return response.untyped(invalid)
      if (!Object.keys(body).length)
        return response.untyped(
          problem(422, 'validation-failed', { errors: { body: [{ code: 'required' }] } }),
        )
      if (body.name !== undefined) item.name = body.name.trim()
      if (body.active !== undefined) item.active = body.active
      if (body.protocols !== undefined) item.protocols = [...body.protocols]
      item.version++
      item.modifiedAt = isoNow(scenario())
      return response(200).json(
        {
          data: {
            ...appPasswordView(params.mailbox, item),
            generatedPassword: body.generatePassword
              ? generatedAppPassword(item.id + item.version * 1000)
              : null,
          },
        },
        { headers: { ETag: appPasswordEtag(params.mailbox, item) } },
      )
    },
  ),
  http.delete(
    '/mailboxes/{mailbox}/app-passwords/{appPasswordId}',
    ({ params, request, response }) => {
      const record = scope(params.mailbox, request, true)
      if (record instanceof Response) return response.untyped(record)
      const item = record.appPasswords.find((item) => item.id === Number(params.appPasswordId))
      if (!item) return response.untyped(notFound())
      const stale = preconditionFailed(request, appPasswordEtag(params.mailbox, item))
      if (stale) return response.untyped(stale)
      record.appPasswords = record.appPasswords.filter((row) => row.id !== item.id)
      return response(204).empty()
    },
  ),
]

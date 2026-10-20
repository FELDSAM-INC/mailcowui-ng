import type { SieveFilterPatch } from '@/api'
import { utf8ByteLength } from '@/shared/validation/utf8'
import {
  checkSieve,
  mockSieveFilter,
  sieveFilterEtag,
  sieveFilterView,
} from '../../factories/sieve-filter'
import { mailboxSelfService, type MockSieveFilter } from '../../scenarios/self-service/state'
import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import {
  addViolation,
  compareValues,
  page,
  validationFailed,
  type Violations,
} from '../domain-rules'
import {
  flagRefusal,
  forbidden,
  isoNow,
  notFound,
  outage,
  preconditionFailed,
  reachMailbox,
} from './rules'

function access(request: Request, mailbox?: string, change = false) {
  const state = scenario()
  if (change) {
    const csrf = csrfProblem(state, request)
    if (csrf) return csrf
  }
  const account = requireAccount(state)
  if (account instanceof Response) return account
  if (!mailbox && account.role === 'mailboxUser') return forbidden()
  if (mailbox) {
    const reached = reachMailbox(state, account, mailbox)
    if (reached instanceof Response) return reached
  }
  if (change) {
    if (account.role === 'mailboxUser') return forbidden()
    const refused = flagRefusal(account, 'filters')
    if (refused) return refused
  }
  return account
}
function validate(body: SieveFilterPatch, create: boolean) {
  const errors: Violations = {}
  if ((create || body.description !== undefined) && !body.description?.trim())
    addViolation(errors, 'description', 'required')
  if ((body.description?.length ?? 0) > 255)
    addViolation(errors, 'description', 'tooLong', { limit: 255 })
  if (create || body.script !== undefined) {
    if (!body.script?.trim()) addViolation(errors, 'script', 'required')
    else if (utf8ByteLength(body.script) > 65535)
      addViolation(errors, 'script', 'tooLong', { limit: 65535, unit: 'bytes' })
    else {
      const syntax = checkSieve(body.script)
      if (syntax) addViolation(errors, 'script', 'sieveSyntax', syntax)
    }
  }
  return Object.keys(errors).length ? validationFailed(errors) : null
}
function activate(item: MockSieveFilter) {
  if (!item.active) return
  for (const other of scenario().selfService.sieveFilters) {
    if (
      other.id !== item.id &&
      other.mailbox === item.mailbox &&
      other.kind === item.kind &&
      other.active
    ) {
      other.active = false
      other.version++
      other.modifiedAt = isoNow(scenario())
    }
  }
}
function listed(request: Request, mailbox?: string) {
  const account = access(request, mailbox)
  if (account instanceof Response) return account
  const state = scenario()
  const url = new URL(request.url)
  const owner = mailbox ?? url.searchParams.get('mailbox')
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const id = url.searchParams.get('id')
  const kind = url.searchParams.get('kind')
  const active = url.searchParams.get('active')
  const sort = (url.searchParams.get('sort') ?? 'mailbox') as keyof ReturnType<
    typeof sieveFilterView
  >
  const direction = url.searchParams.get('order') === 'desc' ? -1 : 1
  const rows = state.selfService.sieveFilters
    .filter(
      (item) =>
        !(reachMailbox(state, account, item.mailbox) instanceof Response) &&
        (!owner || item.mailbox === owner.toLowerCase()) &&
        (!id || item.id === Number(id)) &&
        (!kind || item.kind === kind) &&
        (active === null || item.active === (active === 'true')) &&
        (!q || `${item.mailbox} ${item.description}`.toLowerCase().includes(q)),
    )
    .map(sieveFilterView)
  rows.sort(
    (a, b) =>
      compareValues(a[sort], b[sort]) * direction || a.description.localeCompare(b.description),
  )
  return page(rows, url)
}
export const sieveFilterHandlers = [
  http.get('/sieve-filters', ({ request, response }) => {
    const result = listed(request)
    return result instanceof Response ? response.untyped(result) : response(200).json(result)
  }),
  http.get('/mailboxes/{mailbox}/sieve-filters', ({ params, request, response }) => {
    const result = listed(request, params.mailbox)
    return result instanceof Response ? response.untyped(result) : response(200).json(result)
  }),
  http.post('/sieve-filters/validation', async ({ request, response }) => {
    const csrf = csrfProblem(scenario(), request)
    if (csrf) return response.untyped(csrf)
    // Validation changes nothing and is explicitly available to read-only managers.
    const account = access(request)
    if (account instanceof Response) return response.untyped(account)
    const { script } = await request.json()
    if (utf8ByteLength(script) > 65535) {
      const errors: Violations = {}
      addViolation(errors, 'script', 'tooLong', { limit: 65535, unit: 'bytes' })
      return response.untyped(validationFailed(errors))
    }
    const syntax = checkSieve(script)
    return response(200).json({ data: { valid: !syntax, message: syntax?.message ?? null } })
  }),
  http.post('/mailboxes/{mailbox}/sieve-filters', async ({ params, request, response }) => {
    const account = access(request, params.mailbox, true)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const invalid = validate(body, true)
    if (invalid) return response.untyped(invalid)
    const state = scenario()
    const item = mockSieveFilter({
      ...body,
      id: state.selfService.nextFilterId++,
      mailbox: params.mailbox.toLowerCase(),
      description: body.description.trim(),
      createdAt: isoNow(state),
    })
    state.selfService.sieveFilters.push(item)
    activate(item)
    return response(201).json(
      { data: sieveFilterView(item) },
      {
        headers: {
          Location: `/api/v2/mailboxes/${item.mailbox}/sieve-filters/${item.id}`,
          ETag: sieveFilterEtag(item),
        },
      },
    )
  }),
  http.get(
    '/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}',
    ({ params, request, response }) => {
      const account = access(request, params.mailbox)
      if (account instanceof Response) return response.untyped(account)
      const item = scenario().selfService.sieveFilters.find(
        (item) =>
          item.id === Number(params.sieveFilterId) && item.mailbox === params.mailbox.toLowerCase(),
      )
      return item
        ? response(200).json(
            { data: sieveFilterView(item) },
            { headers: { ETag: sieveFilterEtag(item) } },
          )
        : response.untyped(notFound())
    },
  ),
  http.patch(
    '/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}',
    async ({ params, request, response }) => {
      const account = access(request, params.mailbox, true)
      if (account instanceof Response) return response.untyped(account)
      const item = scenario().selfService.sieveFilters.find(
        (item) =>
          item.id === Number(params.sieveFilterId) && item.mailbox === params.mailbox.toLowerCase(),
      )
      if (!item) return response.untyped(notFound())
      if (item.failWith) return response.untyped(problem(item.failWith, null))
      const stale = preconditionFailed(request, sieveFilterEtag(item))
      if (stale) return response.untyped(stale)
      const body = await request.json()
      const invalid = validate(body, false)
      if (invalid) return response.untyped(invalid)
      Object.assign(item, body, { modifiedAt: isoNow(scenario()), version: item.version + 1 })
      activate(item)
      return response(200).json(
        { data: sieveFilterView(item) },
        { headers: { ETag: sieveFilterEtag(item) } },
      )
    },
  ),
  http.delete(
    '/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}',
    ({ params, request, response }) => {
      const account = access(request, params.mailbox, true)
      if (account instanceof Response) return response.untyped(account)
      const state = scenario()
      const item = state.selfService.sieveFilters.find(
        (item) =>
          item.id === Number(params.sieveFilterId) && item.mailbox === params.mailbox.toLowerCase(),
      )
      if (!item) return response.untyped(notFound())
      if (item.failWith) return response.untyped(problem(item.failWith, null))
      const stale = preconditionFailed(request, sieveFilterEtag(item))
      if (stale) return response.untyped(stale)
      state.selfService.sieveFilters = state.selfService.sieveFilters.filter(
        (value) => value !== item,
      )
      return response(204).empty()
    },
  ),
  http.get('/mailboxes/{mailbox}/active-sieve-script', ({ params, request, response }) => {
    const account = access(request, params.mailbox)
    if (account instanceof Response) return response.untyped(account)
    const unavailable = outage(scenario(), 'mailStore')
    if (unavailable) return response.untyped(unavailable)
    const script = mailboxSelfService(scenario(), params.mailbox).activeScript
    return response(200).json({
      data: {
        mailbox: params.mailbox.toLowerCase(),
        name: script?.name ?? null,
        script: script?.script ?? null,
      },
    })
  }),
]

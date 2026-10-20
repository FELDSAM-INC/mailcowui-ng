import type { MassMailSelection, MassMailJob, MassMailRecipient } from '@/api'
import { http, problem, scenario } from './context'
import { requireAdmin, addViolation, validationFailed, type Violations } from './domain-rules'
import { addressOf } from '../factories/mailbox'
import { massMailId, mockMassMailJob, mockMassMailRecipient } from '../factories/mass-mail'

function select(selection: MassMailSelection) {
  const state = scenario(),
    errors: Violations = {}
  const normal = (values: readonly string[] | undefined) =>
    values?.map((v) => v.trim().toLowerCase())
  const domains = normal(selection.domains),
    include = normal(selection.include),
    exclude = normal(selection.exclude)
  if (include && exclude) addViolation(errors, 'selection', 'mutuallyExclusive')
  domains?.forEach((domain, i) => {
    if (!state.domains.some((item) => item.name === domain))
      addViolation(errors, `selection.domains.${i}`, 'notFound')
  })
  for (const [list, values] of [
    ['include', include],
    ['exclude', exclude],
  ] as const)
    values?.forEach((address, i) => {
      const mailbox = state.mailboxes.find((entry) => addressOf(entry) === address)
      if (!mailbox) addViolation(errors, `selection.${list}.${i}`, 'notFound')
      else if (mailbox.status === 'inactive')
        addViolation(errors, `selection.${list}.${i}`, 'notEligible', { reason: 'notReceiving' })
      else if (domains?.length && !domains.includes(mailbox.domain))
        addViolation(errors, `selection.${list}.${i}`, 'notEligible', {
          reason: 'outsideSelectedDomains',
        })
    })
  if (Object.keys(errors).length) return validationFailed(errors)
  return state.mailboxes
    .filter(
      (m) =>
        m.status !== 'inactive' &&
        (!domains?.length || domains.includes(m.domain)) &&
        (!include || include.includes(addressOf(m))) &&
        (!exclude || !exclude.includes(addressOf(m))),
    )
    .map((m) => ({ address: addressOf(m), domain: m.domain }))
    .sort((a, b) => a.address.localeCompare(b.address))
}
function page<T>(items: T[], request: Request, matches: (entry: T, q: string) => boolean) {
  const params = new URL(request.url).searchParams,
    q = (params.get('q') ?? '').toLowerCase()
  const limit = Number(params.get('limit') ?? 25),
    offset = Number(params.get('offset') ?? 0)
  const filtered = q ? items.filter((item) => matches(item, q)) : items
  return {
    data: filtered.slice(offset, offset + limit),
    meta: { total: filtered.length, limit, offset },
  }
}
function recalculate(job: MassMailJob, recipients: MassMailRecipient[]) {
  job.counts = { delivered: 0, failed: 0, skipped: 0, pending: 0 }
  recipients.forEach((entry) => {
    job.counts[entry.outcome]++
  })
}
export const massMailHandlers = [
  http.post('/mass-mail-jobs/recipient-preview', async ({ request, response }) => {
    const account = requireAdmin(scenario())
    if (account instanceof Response) return response.untyped(account)
    const items = select((await request.json()).selection)
    if (items instanceof Response) return response.untyped(items)
    const result = page(items, request, (item, q) => item.address.includes(q))
    return response(200).json({ ...result, meta: { ...result.meta, recipientCount: items.length } })
  }),
  http.post('/mass-mail-jobs', async ({ request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const body = await request.json(),
      errors: Violations = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.sender))
      addViolation(errors, 'sender', 'invalidFormat', { format: 'email' })
    if (!body.subject.trim()) addViolation(errors, 'subject', 'required')
    if (/[\r\n]/.test(body.subject))
      addViolation(errors, 'subject', 'invalidFormat', { format: 'singleLine' })
    if (!body.textBody.trim()) addViolation(errors, 'textBody', 'required')
    for (const field of ['textBody', 'htmlBody'] as const)
      if (body[field] && Buffer.byteLength(body[field]) > 1048576)
        addViolation(errors, field, 'tooLong', { max: 1048576, unit: 'bytes' })
    if (Object.keys(errors).length) return response.untyped(validationFailed(errors))
    const items = select(body.selection)
    if (items instanceof Response) return response.untyped(items)
    if (!items.length)
      return response.untyped(
        validationFailed({
          selection: [
            { code: 'tooFew', message: 'At least one recipient is required.', params: { min: 1 } },
          ],
        }),
      )
    const running = state.massMail.jobs.find((job) => job.status === 'running')
    if (running)
      return response.untyped(
        problem(409, 'mass-mail-already-running', { runningJobId: running.id }),
      )
    if (items.length !== body.expectedRecipients)
      return response.untyped(
        problem(409, 'mass-mail-recipient-count-changed', { actualRecipients: items.length }),
      )
    const job = mockMassMailJob({
      sender: body.sender,
      subject: body.subject,
      textBody: body.textBody,
      selection: body.selection,
      htmlBody: body.htmlBody ?? null,
      id: massMailId(state.massMail.jobs.length + 1),
      recipientCount: items.length,
      counts: { pending: items.length, delivered: 0, failed: 0, skipped: 0 },
      createdBy: { username: account.username },
      createdAt: new Date(state.now()).toISOString(),
    })
    state.massMail.jobs.unshift(job)
    state.massMail.recipients[job.id] = items.map((item) => mockMassMailRecipient(item.address))
    return response(201).json(
      { data: job },
      { headers: { Location: `/api/v2/mass-mail-jobs/${job.id}` } },
    )
  }),
  http.get('/mass-mail-jobs', ({ request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const status = new URL(request.url).searchParams.get('status')
    const jobs = state.massMail.jobs
      .filter((job) => !status || job.status === status)
      .map(({ textBody: _text, htmlBody: _html, ...summary }) => summary)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return response(200).json(
      page(jobs, request, (item, q) => item.subject.toLowerCase().includes(q)),
    )
  }),
  http.get('/mass-mail-jobs/{jobId}', ({ params, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const job = state.massMail.jobs.find((item) => item.id === params.jobId)
    if (!job) return response.untyped(problem(404, null))
    if (job.status === 'running' && state.massMail.step > 0) {
      const recipients = state.massMail.recipients[job.id] ?? []
      recipients
        .filter((item) => item.outcome === 'pending')
        .slice(0, state.massMail.step)
        .forEach((item) =>
          Object.assign(item, {
            outcome: 'delivered',
            attempts: 1,
            lastAttemptAt: new Date(state.now()).toISOString(),
          }),
        )
      recalculate(job, recipients)
      if (!job.counts.pending) {
        job.status = 'completed'
        job.finishedAt = new Date(state.now()).toISOString()
      }
    }
    return response(200).json({ data: job })
  }),
  http.get('/mass-mail-jobs/{jobId}/recipients', ({ params, request, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (!state.massMail.jobs.some((job) => job.id === params.jobId))
      return response.untyped(problem(404, null))
    const outcome = new URL(request.url).searchParams.get('outcome')
    const items = (state.massMail.recipients[params.jobId] ?? [])
      .filter((item) => !outcome || item.outcome === outcome)
      .sort((a, b) => a.address.localeCompare(b.address))
    return response(200).json(page(items, request, (item, q) => item.address.includes(q)))
  }),
  http.post('/mass-mail-jobs/{jobId}/cancellation', ({ params, response }) => {
    const state = scenario(),
      account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.settings.capabilities.demoMode) return response.untyped(problem(403, 'demo-mode'))
    const job = state.massMail.jobs.find((item) => item.id === params.jobId)
    if (!job) return response.untyped(problem(404, null))
    if (job.status === 'completed') return response.untyped(problem(409, null))
    if (job.status === 'running') {
      const recipients = state.massMail.recipients[job.id] ?? []
      recipients
        .filter((item) => item.outcome === 'pending')
        .forEach((item) => {
          item.outcome = 'skipped'
        })
      recalculate(job, recipients)
      job.status = 'cancelled'
      job.finishedAt = new Date(state.now()).toISOString()
      job.cancelledBy = { username: account.username }
    }
    return response(200).json({ data: job })
  }),
]

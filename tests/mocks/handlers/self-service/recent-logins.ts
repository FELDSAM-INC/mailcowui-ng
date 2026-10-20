import { mailboxSelfService } from '../../scenarios/self-service/state'
import { csrfProblem, http, requireAccount, scenario } from '../context'
import { compareValues, page, validationFailed } from '../domain-rules'
import { outage, reachMailbox } from './rules'

function recordFor(mailbox: string, request: Request, change: boolean) {
  const state = scenario()
  if (change) {
    const csrf = csrfProblem(state, request)
    if (csrf) return csrf
  }
  const account = requireAccount(state)
  if (account instanceof Response) return account
  const reached = reachMailbox(state, account, mailbox)
  if (reached instanceof Response) return reached
  const unavailable = outage(state, 'sharedStore')
  if (unavailable) return unavailable
  return mailboxSelfService(state, mailbox)
}
export const recentLoginHandlers = [
  http.get('/mailboxes/{mailbox}/recent-logins', ({ params, request, response }) => {
    const record = recordFor(params.mailbox, request, false)
    if (record instanceof Response) return response.untyped(record)
    const url = new URL(request.url)
    const days = Number(url.searchParams.get('days') ?? 7)
    if (!Number.isInteger(days) || days < 1 || days > 31)
      return response.untyped(
        validationFailed({
          days: [
            {
              code: 'outOfRange',
              message: 'Period outside the allowed range.',
              params: { min: 1, max: 31 },
            },
          ],
        }),
      )
    const service = (url.searchParams.get('service') ?? '').toUpperCase()
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const sort = (url.searchParams.get('sort') ?? 'lastSeenAt') as
      'lastSeenAt' | 'service' | 'clientAddress'
    const order = url.searchParams.get('order') ?? (sort === 'lastSeenAt' ? 'desc' : 'asc')
    const since = scenario().now() - days * 86_400_000
    const rows = record.recentLogins
      .filter(
        (item) =>
          Date.parse(item.lastSeenAt) >= since &&
          (!service || item.service.toUpperCase() === service) &&
          (!q || item.clientAddress.toLowerCase().includes(q)),
      )
      .map((item) => ({
        ...item,
        appPassword: item.appPassword
          ? {
              ...item.appPassword,
              name:
                record.appPasswords.find((password) => password.id === item.appPassword?.id)
                  ?.name ?? null,
            }
          : null,
      }))
    rows.sort((a, b) => compareValues(a[sort], b[sort]) * (order === 'desc' ? -1 : 1))
    return response(200).json(page(rows, url))
  }),
  http.delete('/mailboxes/{mailbox}/recent-logins', ({ params, request, response }) => {
    const record = recordFor(params.mailbox, request, true)
    if (record instanceof Response) return response.untyped(record)
    record.recentLogins = []
    return response(204).empty()
  }),
]

// Mailbox templates (UI 003 T011, US7 T102): the list with the name search, sort and paging, and
// one template with its ETag. Domain administrators read them without the user permissions their
// flags do not allow. US7 adds the writes below the reads.
import { compareValues, notFound, page, requireManager } from './domain-rules'
import { mailboxTemplateView } from '../factories/mailbox-template'
import type { MockMailboxTemplate } from '../scenarios/state'
import { http, scenario } from './context'

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

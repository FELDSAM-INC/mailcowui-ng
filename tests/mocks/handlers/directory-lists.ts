// The list operations of feature 004 that UI 002 reads for the footer's exclusions (listAliases,
// listAliasDomains): the domains in the caller's scope, filtered by domain (or target domain) and
// the search, paged. UI 003 replaced listMailboxes with its full handler (`mailboxes-read.ts`);
// UI 004 replaces these with its own.
import { aliasDomainView, aliasView } from '../factories/directory'
import { aliasAddresses } from '../factories/domain'
import { http, scenario } from './context'
import { page, requireManager, scopeOf } from './domain-rules'

const matches = (value: string, q: string | null) =>
  !q || value.toLowerCase().includes(q.toLowerCase())

export const directoryListHandlers = [
  http.get('/aliases', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const domains = url.searchParams.getAll('domain').map((name) => name.toLowerCase())
    const q = url.searchParams.get('q')
    const items = scopeOf(state, account)
      .filter((domain) => domains.length === 0 || domains.includes(domain.name))
      .flatMap((domain) => aliasAddresses(domain))
      .filter((address) => matches(address, q))
      .sort()
      .map((address, index) => aliasView(index + 1, address))
    return response(200).json(page(items, url))
  }),

  http.get('/alias-domains', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const targets = url.searchParams.getAll('targetDomain').map((name) => name.toLowerCase())
    const q = url.searchParams.get('q')
    const inScope = new Set(scopeOf(state, account).map((domain) => domain.name))
    const items = state.aliasDomains
      .filter((alias) => inScope.has(alias.target))
      .filter((alias) => targets.length === 0 || targets.includes(alias.target))
      .filter((alias) => matches(alias.name, q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((alias) => aliasDomainView(alias.name, alias.target))
    return response(200).json(page(items, url))
  }),
]

// `renameMailbox` (UI 003 T111, research R20): the new local part in the same domain, with an
// optional alias from the old address; `If-Match` with 412; 422 `unchanged` or `invalidFormat`;
// 409 `mailbox-not-renamable` for inactive mailboxes, `address-in-use` naming the holder and
// `domain-alias-limit-reached`; injected 503 `temporary-failure`, 500 `mailbox-rename-incomplete`
// and 504 `outcome-unknown` with their steps; 200 with `Content-Location` and `ETag`.

import { aliasAddresses } from '../factories/domain'
import { addressOf, mailboxEtag, mailboxView } from '../factories/mailbox'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  notFound,
  outdated,
  requireManager,
  validationFailed,
  type Violations,
} from './domain-rules'
import { checkLocalPart, findMailbox, mailboxFailure } from './mailbox-rules'

/** What holds an address in the domain: a mailbox, an alias, or nothing. */
function holderOf(state: ScenarioState, address: string): 'mailbox' | 'alias' | null {
  if (state.mailboxes.some((mailbox) => addressOf(mailbox) === address)) return 'mailbox'
  const domain = state.domains.find((item) => item.name === address.split('@')[1])
  if (domain && aliasAddresses(domain).includes(address)) return 'alias'
  return null
}

export const mailboxRenameHandlers = [
  http.post('/mailboxes/{mailbox}/rename', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = findMailbox(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== '*' && ifMatch !== mailboxEtag(mailbox)) {
      return response.untyped(outdated())
    }
    const body = await request.json()
    const errors: Violations = {}
    const localPart = checkLocalPart(errors, 'newLocalPart', body.newLocalPart, mailbox.domain)
    if (Object.keys(errors).length === 0 && localPart === mailbox.localPart) {
      addViolation(errors, 'newLocalPart', 'unchanged')
    }
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (mailbox.status === 'inactive') {
      return response.untyped(problem(409, 'mailbox-not-renamable'))
    }
    const previous = addressOf(mailbox)
    const next = `${localPart}@${mailbox.domain}`
    const holder = holderOf(state, next)
    if (holder) {
      return response.untyped(problem(409, 'address-in-use', { address: next, holder }))
    }
    const domain = state.domains.find((item) => item.name === mailbox.domain)
    if (body.keepOldAddressAsAlias && domain && domain.usage.aliases >= domain.maxAliases) {
      return response.untyped(
        problem(409, 'domain-alias-limit-reached', {
          domain: domain.name,
          count: domain.usage.aliases,
          limit: domain.maxAliases,
          requested: 1,
        }),
      )
    }
    const failure = mailboxFailure(state, previous, 'renameMailbox')
    if (failure) return response.untyped(failure)
    mailbox.localPart = localPart
    mailbox.modifiedAt = new Date(state.now()).toISOString()
    if (body.keepOldAddressAsAlias && domain) {
      domain.aliasAddresses = [...aliasAddresses(domain), previous]
      domain.usage.aliases += 1
    }
    const data = {
      ...mailboxView(state, mailbox, account),
      previousAddress: previous,
      oldAddressKeptAsAlias: body.keepOldAddressAsAlias,
    }
    return response(200).json({ data } as never, {
      headers: { ETag: data.etag, 'Content-Location': `/api/v2/mailboxes/${next}` },
    })
  }),
]

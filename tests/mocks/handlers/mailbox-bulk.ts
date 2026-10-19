// `applyMailboxBulkAction` (UI 003 T095, research R20): one outcome per distinct target, `notFound`
// for a missing or foreign mailbox, `outdated` for a stale version (with or without the quotes),
// `failed` or `refused` as injected for the mailbox; a domain administrator without
// `protocolAccess` is refused protocol actions as a whole (403 `permission-flag-required`); more
// targets than `bulkLimit` answer 422 `tooMany`. Deletions update the domains' usage.
import type { BulkItemResult } from '@/api'

import { addressOf, mailboxEtag, syncDomainUsage } from '../factories/mailbox'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  outdated,
  requireManager,
  validationFailed,
  type Violations,
} from './domain-rules'
import { bareVersion, bulkRequestId, findMailbox, mailboxFailure } from './mailbox-rules'

const STATUS = {
  activate: 'active',
  disableLogin: 'loginDisabled',
  deactivate: 'inactive',
} as const

export const mailboxBulkHandlers = [
  http.post('/mailboxes/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const protocolAction = body.action === 'allowProtocol' || body.action === 'disallowProtocol'
    if (protocolAction && account.role !== 'admin' && !account.permissions.protocolAccess) {
      return response.untyped(
        problem(403, 'permission-flag-required', { requiredFlags: ['protocolAccess'] }),
      )
    }
    const limit = state.mailboxCapabilities.bulkLimit
    if (body.targets.length > limit) {
      const errors: Violations = {}
      addViolation(errors, 'targets', 'tooMany', { max: limit })
      return response.untyped(validationFailed(errors))
    }
    const seen = new Set<string>()
    const results: BulkItemResult[] = []
    const itemProblem = async (answer: Response) =>
      (await answer.json()) as BulkItemResult['problem']
    const touched = new Set<string>()
    for (const target of body.targets) {
      const mailbox = findMailbox(state, account, target.id)
      const key = mailbox ? addressOf(mailbox) : target.id.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      if (!mailbox) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      if (
        target.version !== undefined &&
        bareVersion(target.version) !== bareVersion(mailboxEtag(mailbox))
      ) {
        results.push({ id: target.id, outcome: 'outdated', problem: await itemProblem(outdated()) })
        continue
      }
      const failure = mailboxFailure(state, key, 'applyMailboxBulkAction')
      if (failure) {
        results.push({
          id: target.id,
          outcome: failure.status === 409 || failure.status === 403 ? 'refused' : 'failed',
          problem: await itemProblem(failure),
        })
        continue
      }
      if (body.action === 'delete') {
        state.mailboxes = state.mailboxes.filter((item) => item !== mailbox)
      } else if (protocolAction && body.protocol) {
        mailbox.protocolAccess = {
          ...mailbox.protocolAccess,
          [body.protocol]: body.action === 'allowProtocol',
        }
      } else if (body.action in STATUS) {
        mailbox.status = STATUS[body.action as keyof typeof STATUS]
      }
      mailbox.modifiedAt = new Date(state.now()).toISOString()
      touched.add(mailbox.domain)
      results.push({ id: target.id, outcome: 'done' })
    }
    for (const name of touched) syncDomainUsage(state, name)
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

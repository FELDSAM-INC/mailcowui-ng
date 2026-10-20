import type { BulkItemResult } from '@/api'
import { addressOf } from '../../factories/mailbox'
import { mailSettingsEtag } from '../../factories/mail-settings'
import { csrfProblem, http, problem, scenario } from '../context'
import { requireManager } from '../domain-rules'
import { bareVersion, bulkRequestId, findMailbox, mailboxFailure } from '../mailbox-rules'
import { outage } from './rules'

export const bulkMailSettingsHandlers = [
  http.post('/mailboxes/mail-settings/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const csrf = csrfProblem(state, request)
    if (csrf) return response.untyped(csrf)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    if (body.targets.length > state.selfService.capabilities.bulkLimit)
      return response.untyped(
        problem(422, 'validation-failed', {
          errors: {
            targets: [
              {
                code: 'tooMany',
                message: 'Too many targets.',
                params: { max: state.selfService.capabilities.bulkLimit },
              },
            ],
          },
        }),
      )
    const results: BulkItemResult[] = []
    const seen = new Set<string>()
    for (const target of body.targets) {
      const mailbox = findMailbox(state, account, target.id)
      const key = mailbox ? addressOf(mailbox) : target.id.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      if (!mailbox) {
        results.push({ id: key, outcome: 'notFound' })
        continue
      }
      if (
        target.version !== undefined &&
        bareVersion(target.version) !== bareVersion(mailSettingsEtag(mailbox))
      ) {
        results.push({ id: key, outcome: 'outdated' })
        continue
      }
      const failed =
        mailboxFailure(state, key, 'applyMailboxMailSettingsBulkAction') ??
        outage(state, 'sharedStore')
      if (failed) {
        results.push({
          id: key,
          outcome: 'failed',
          problem: (await failed.json()) as BulkItemResult['problem'],
        })
        continue
      }
      if (body.tlsEnforceInbound !== undefined) mailbox.tlsEnforceInbound = body.tlsEnforceInbound
      if (body.tlsEnforceOutbound !== undefined)
        mailbox.tlsEnforceOutbound = body.tlsEnforceOutbound
      results.push({ id: key, outcome: 'done' })
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
          outdated: count('outdated'),
          refused: count('refused'),
          failed: count('failed'),
        },
      },
    })
  }),
]

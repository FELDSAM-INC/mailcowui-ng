// Shared by the rate-limit overview and the operations log: reset the stored bucket, remove its
// log entries and record the audit event. A bucket absent from both stores answers 404.
import { csrfProblem, http, problem, requireAccount } from './context'
import { operationGate } from './operations-context'
import { audit } from './quarantine-rules'

export const rateLimitBucketHandlers = [
  http.delete('/rate-limit-buckets/{bucketId}', async ({ params, request, response }) => {
    const gate = await operationGate('resetRateLimitBucket')
    if (gate.stop) return response.untyped(gate.stop)
    const csrf = csrfProblem(gate.state, request)
    if (csrf) return response.untyped(csrf)
    const account = requireAccount(gate.state)
    if (account instanceof Response) return response.untyped(account)
    const logs = gate.state.operations.logs
    const bucketId = String(params.bucketId)
    const target = { type: 'rateLimitBucket' as const, id: bucketId, name: bucketId }
    const entries = logs.entries['rate-limits']
    const countersExisted = gate.state.quarantine.buckets.includes(bucketId)
    const logEntriesRemoved = entries.filter((entry) => entry.rateLimitHash === bucketId).length
    if (logs.resetBuckets.includes(bucketId) || (!countersExisted && logEntriesRemoved === 0)) {
      audit(gate.state, account, {
        eventType: 'rateLimitBucketReset',
        target,
        details: { problemType: 'about:blank', status: 404 },
        failureReason: 'notFound',
      })
      return response.untyped(gate.finish(problem(404, null)))
    }
    logs.resetBuckets.push(bucketId)
    logs.entries['rate-limits'] = entries.filter((entry) => entry.rateLimitHash !== bucketId)
    gate.state.quarantine.buckets = gate.state.quarantine.buckets.filter((id) => id !== bucketId)
    audit(gate.state, account, {
      eventType: 'rateLimitBucketReset',
      target,
      details: { countersExisted, logEntriesRemoved },
    })
    return response.untyped(gate.finish(new Response(null, { status: 204 })))
  }),
]

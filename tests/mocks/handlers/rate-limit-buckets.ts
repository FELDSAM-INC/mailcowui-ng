// Rate limit bucket handler (UI 011 plan item 26, T071): `resetRateLimitBucket` for the rate-limited
// log's "Remove hash". A bucket that the rate-limited log still lists is reset once (204), which
// also removes its log entries; a bucket reset before, or never listed, answers 404. UI 006 may
// later own this module.
import { csrfProblem, http, problem } from './context'
import { operationGate } from './operations-context'

export const rateLimitBucketHandlers = [
  http.delete('/rate-limit-buckets/{bucketId}', async ({ params, request, response }) => {
    const gate = await operationGate('resetRateLimitBucket')
    if (gate.stop) return response.untyped(gate.stop)
    const csrf = csrfProblem(gate.state, request)
    if (csrf) return response.untyped(csrf)
    const logs = gate.state.operations.logs
    const bucketId = String(params.bucketId)
    const entries = logs.entries['rate-limits']
    if (
      logs.resetBuckets.includes(bucketId) ||
      !entries.some((e) => e.rateLimitHash === bucketId)
    ) {
      return response.untyped(gate.finish(problem(404, null)))
    }
    logs.resetBuckets.push(bucketId)
    logs.entries['rate-limits'] = entries.filter((entry) => entry.rateLimitHash !== bucketId)
    return response.untyped(gate.finish(new Response(null, { status: 204 })))
  }),
]

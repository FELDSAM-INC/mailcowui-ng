// UI 011 (research R17, T016): an action that was carried out without an audit record carries
// `Audit-Recorded: false`, on a success and on a problem; every other answer counts as recorded.
import { describe, expect, it } from 'vitest'

import { ApiProblem, isAuditRecorded } from '@/api'
import { problemFromResponse } from '@/api/problem'

function problemResponse(headers: Record<string, string> = {}) {
  return new Response(
    JSON.stringify({ type: '/api/v2/problems/outcome-unknown', status: 504, step: 'restart' }),
    { status: 504, headers: { 'Content-Type': 'application/problem+json', ...headers } },
  )
}

describe('Audit-Recorded', () => {
  it('marks a problem as not recorded only with Audit-Recorded: false', async () => {
    expect((await problemFromResponse(problemResponse())).auditRecorded).toBe(true)
    expect(
      (await problemFromResponse(problemResponse({ 'Audit-Recorded': 'false' }))).auditRecorded,
    ).toBe(false)
    expect(
      (await problemFromResponse(problemResponse({ 'Audit-Recorded': 'true' }))).auditRecorded,
    ).toBe(true)
  })

  it('counts problems built without a response as recorded', () => {
    expect(ApiProblem.fromParts({ kind: 'network' }).auditRecorded).toBe(true)
  })

  it('reads the same header from a success response', () => {
    expect(isAuditRecorded(new Response('{}', { status: 200 }))).toBe(true)
    expect(isAuditRecorded(new Response('{}', { headers: { 'Audit-Recorded': 'false' } }))).toBe(
      false,
    )
    expect(isAuditRecorded(new Response('{}', { headers: { 'audit-recorded': 'FALSE' } }))).toBe(
      false,
    )
    expect(isAuditRecorded(undefined)).toBe(true)
  })
})

// The US8 mock handler (T135): the filters of listAuditEvents, paging, access and 422 answers.
import { describe, expect, it } from 'vitest'

import { addressMatches, isNetworkFilter } from '../../mocks/handlers/audit'
import { useScenario } from '../../mocks/node'
import { AUDIT_ACTING_KEY_ID } from '../../mocks/scenarios/audit-log'

interface ListBody {
  data: { eventType: string; outcome: string; clientAddress: string; occurredAt: string }[]
  meta: { total: number; limit: number; offset: number }
}

async function list(query = '') {
  const response = await fetch(`${location.origin}/api/v2/audit-events${query}`)
  return {
    response,
    body: (await response.json()) as ListBody & { type?: string; errors?: object },
  }
}

describe('listAuditEvents mock', () => {
  it('lists newest first with paging metadata', async () => {
    useScenario('audit-records')
    const { body } = await list('?limit=25')
    expect(body.data).toHaveLength(25)
    expect(body.meta.total).toBeGreaterThan(25)
    const times = body.data.map((event) => new Date(event.occurredAt).getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    const second = await list('?limit=25&offset=25')
    expect(second.body.data.length).toBe(body.meta.total - 25)
  })

  it('combines event types, outcome, actor, address and time range', async () => {
    useScenario('audit-records')
    const { body } = await list(
      '?eventType=signIn&outcome=failure&actor=alice%40example.org&clientAddress=192.0.2.0%2F24',
    )
    expect(body.meta.total).toBe(3)
    expect(new Set(body.data.map((e) => e.clientAddress))).toEqual(new Set(['192.0.2.10']))
    const keys = await list('?eventType=apiKeyCreation&eventType=apiKeyRevocation')
    expect(keys.body.meta.total).toBe(3)
    const byKey = await list(`?actor=${AUDIT_ACTING_KEY_ID}`)
    expect(byKey.body.meta.total).toBe(1)
    const from = new Date(Date.now() - 24 * 3_600_000).toISOString()
    const recent = await list(`?from=${encodeURIComponent(from)}`)
    expect(recent.body.meta.total).toBe(13)
  })

  it('refuses a malformed address and an inverted range with 422', async () => {
    useScenario('audit-records')
    const address = await list('?clientAddress=999.1.1.1')
    expect(address.response.status).toBe(422)
    expect(address.body.errors).toHaveProperty('clientAddress')
    const range = await list(
      `?from=${encodeURIComponent('2026-10-10T00:00:00Z')}&to=${encodeURIComponent('2026-10-01T00:00:00Z')}`,
    )
    expect(range.response.status).toBe(422)
  })

  it('is for administrators only', async () => {
    useScenario('audit-records', { signedInAs: 'reseller' })
    expect((await list()).response.status).toBe(403)
  })

  it('matches addresses and prefixes', () => {
    expect(addressMatches('192.0.2.10', '192.0.2.10')).toBe(true)
    expect(addressMatches('192.0.2.10', '192.0.2.0/24')).toBe(true)
    expect(addressMatches('192.0.3.10', '192.0.2.0/24')).toBe(false)
    expect(addressMatches('2001:db8::17', '2001:db8::/32')).toBe(true)
    expect(isNetworkFilter('999.1.1.1')).toBe(false)
    expect(isNetworkFilter('10.0.0.0/33')).toBe(false)
  })
})

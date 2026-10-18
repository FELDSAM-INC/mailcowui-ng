// The US8 mock handler (T135): the filters of listAuditEvents, paging, access and 422 answers.
import { describe, expect, it } from 'vitest'

import { domainAuditEvent } from '../../mocks/factories/audit-event'
import { addressMatches, isNetworkFilter } from '../../mocks/handlers/audit'
import { useScenario } from '../../mocks/node'
import { AUDIT_ACTING_KEY_ID } from '../../mocks/scenarios/audit-log'
import { HISTORY_KEY } from '../../mocks/scenarios/domains-history'

interface ListBody {
  data: {
    eventType: string
    outcome: string
    clientAddress: string
    occurredAt: string
    target: { type: string; id: string | null } | null
  }[]
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

  it('UI 002 T095 filters by target type and identifier, domain names in either form and any case', async () => {
    useScenario('audit-domain-records')
    const domain = await list('?targetId=example.org')
    expect(domain.body.data.map((event) => event.eventType)).toEqual([
      'domainFooterUpdate',
      'domainUpdate',
      'domainUpdate',
      'domainCreation',
    ])
    expect((await list('?targetId=EXAMPLE.ORG')).body.meta.total).toBe(4)
    const typed = await list('?targetType=domain&targetId=Example.Org')
    expect(typed.body.data.map((event) => event.target?.type)).toEqual([
      'domain',
      'domain',
      'domain',
    ])
    const footer = await list('?targetType=domainFooter&targetId=example.org')
    expect(footer.body.meta.total).toBe(1)
    const template = await list('?targetType=domainTemplate&targetId=2')
    expect(template.body.data.map((event) => event.eventType)).toEqual([
      'domainTemplateUpdate',
      'domainTemplateCreation',
    ])
    const templates = await list('?targetType=domainTemplate')
    expect(templates.body.meta.total).toBe(3)
    const key = await list(`?targetType=apiKey&targetId=${HISTORY_KEY.id}`)
    expect(key.body.meta.total).toBe(1)
    expect((await list('?targetId=nothing.example')).body.meta.total).toBe(0)
  })

  it('UI 002 T095 matches the Unicode form of an IDN target', async () => {
    useScenario('audit-domain-records', {
      auditEvents: [
        domainAuditEvent(
          'domainUpdate',
          { id: 'xn--mnchen-3ya.de', name: 'münchen.de' },
          { details: { changes: {} } },
        ),
      ],
    })
    expect((await list(`?targetId=${encodeURIComponent('MÜNCHEN.de')}`)).body.meta.total).toBe(1)
    expect((await list('?targetId=xn--mnchen-3ya.de')).body.meta.total).toBe(1)
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

import { beforeEach, describe, expect, it } from 'vitest'
import { api, requireData, type SieveFilterCreateRequest } from '@/api'
import { mockState, useScenario } from '../../mocks/node'
import { mailboxSelfService } from '../../mocks/scenarios/self-service/state'

const mailbox = 'anna@example.org'
async function create(body: Partial<SieveFilterCreateRequest> = {}) {
  return requireData(
    await api.POST('/mailboxes/{mailbox}/sieve-filters', {
      params: { path: { mailbox } },
      body: {
        description: 'Test filter',
        kind: 'prefilter',
        script: 'keep;',
        active: true,
        ...body,
      },
    }),
  ).data
}
describe('Sieve contract mock', () => {
  beforeEach(() => {
    useScenario('account-admin')
  })
  it('reserves seeded IDs and permits read-only domain administrators to validate without saving', async () => {
    useScenario('filters-many')
    const added = await create()
    expect(added.id).toBeGreaterThan(40)
    expect(new Set(mockState().selfService.sieveFilters.map((item) => item.id)).size).toBe(41)
    useScenario('filters-domain-admin-no-flag')
    expect(
      requireData(await api.POST('/sieve-filters/validation', { body: { script: 'keep;' } })).data
        .valid,
    ).toBe(true)
    expect(mockState().selfService.sieveFilters).toHaveLength(40)
  })
  it('validates syntax without saving, and rejects syntax or oversized UTF-8 scripts on creation', async () => {
    const checked = requireData(
      await api.POST('/sieve-filters/validation', { body: { script: 'unknown_command;' } }),
    ).data
    expect(checked.valid).toBe(false)
    expect(checked.message).toContain('line 1')
    expect(mockState().selfService.sieveFilters).toHaveLength(0)
    await expect(create({ script: 'unknown_command;' })).rejects.toMatchObject({ status: 422 })
    await expect(create({ script: `#${'é'.repeat(32768)}` })).rejects.toMatchObject({ status: 422 })
  })
  it('creates, lists and switches the one active filter of each kind with version checks', async () => {
    const first = await create({ description: 'First' })
    const second = await create({ description: 'Second' })
    const filters = requireData(
      await api.GET('/mailboxes/{mailbox}/sieve-filters', { params: { path: { mailbox } } }),
    ).data
    expect(filters.find((item) => item.id === first.id)?.active).toBe(false)
    expect(filters.find((item) => item.id === second.id)?.active).toBe(true)
    await expect(
      api.PATCH('/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}', {
        params: { path: { mailbox, sieveFilterId: first.id }, header: { 'If-Match': first.etag } },
        body: { active: true },
        headers: { 'Content-Type': 'application/merge-patch+json' },
      }),
    ).rejects.toMatchObject({ status: 412 })
    const post = await create({ kind: 'postfilter' })
    await api.PATCH('/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}', {
      params: { path: { mailbox, sieveFilterId: second.id }, header: { 'If-Match': second.etag } },
      body: { kind: 'postfilter' },
      headers: { 'Content-Type': 'application/merge-patch+json' },
    })
    expect(mockState().selfService.sieveFilters.find((item) => item.id === post.id)?.active).toBe(
      false,
    )
  })
  it('filters global lists and refuses mutations for read-only domain admins and mailbox users', async () => {
    await create({ description: 'Wanted' })
    await create({ description: 'Other', kind: 'postfilter' })
    expect(
      requireData(
        await api.GET('/sieve-filters', {
          params: { query: { mailbox, q: 'wanted', kind: 'prefilter' } },
        }),
      ).data,
    ).toHaveLength(1)
    const reseller = mockState().accounts.find((account) => account.username === 'reseller')!
    reseller.permissions.filters = false
    mockState().session.username = reseller.username
    await expect(create()).rejects.toMatchObject({
      status: 403,
      type: '/api/v2/problems/permission-flag-required',
    })
  })
  it('shows only the own active script for mailbox users and reports the mail-store outage', async () => {
    useScenario('account-mailbox')
    await expect(create()).rejects.toMatchObject({ status: 403 })
    await expect(api.GET('/sieve-filters')).rejects.toMatchObject({ status: 403 })
    expect(
      requireData(
        await api.GET('/mailboxes/{mailbox}/active-sieve-script', {
          params: { path: { mailbox } },
        }),
      ).data,
    ).toEqual({ mailbox, name: null, script: null })
    mailboxSelfService(mockState(), mailbox).activeScript = { name: 'mailrules', script: 'keep;' }
    expect(
      requireData(
        await api.GET('/mailboxes/{mailbox}/active-sieve-script', {
          params: { path: { mailbox } },
        }),
      ).data.script,
    ).toBe('keep;')
    mockState().selfService.outages.mailStore = true
    await expect(
      api.GET('/mailboxes/{mailbox}/active-sieve-script', { params: { path: { mailbox } } }),
    ).rejects.toMatchObject({ status: 503 })
  })
})

import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '@/api'
import {
  createRule,
  deleteRule,
  fetchEffectiveMap,
  fetchRule,
  fetchRules,
  rulesOptions,
  updateRule,
  validateNewRule,
  validateRule,
} from '@/features/system-settings/api/rspamd-rules'
import { fetchPresets } from '@/features/system-settings/api/presets'
import { useScenario } from '../../../mocks/node'

const body = {
  description: 'A test rule',
  content: 'apply { symbols = ["{", "}"]; }',
  active: true,
}

describe('Rspamd settings contract API (T106/T111)', () => {
  it('paginates, searches content, filters inactive and sorts with full versioned items', async () => {
    useScenario('rspamd-rules-30')
    const all = await fetchRules({ limit: 25, offset: 25, sort: 'id', order: 'asc' })
    expect(all.meta).toMatchObject({ total: 30, limit: 25, offset: 25 })
    expect(all.data.map((row) => row.id)).toEqual([26, 27, 28, 29, 30])
    const filtered = await fetchRules({
      q: 'needle-content',
      active: false,
      sort: 'id',
      order: 'desc',
    })
    expect(filtered.data.map((row) => row.id)).toEqual([30, 20, 10])
    expect(filtered.data[0]).toHaveProperty('content')
    expect(filtered.data[0]).toHaveProperty('etag')
  })

  it('seeds full list entries and invalidates list/effective map/audit after writes', async () => {
    useScenario('rspamd-rules-30')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await client.fetchQuery(rulesOptions({}, client))
    expect(client.getQueryData(queryKeys.rspamdRules.detail(1))).toMatchObject({ id: 1 })
    client.setQueryData(queryKeys.rspamdSettingsMap(), { content: 'before' })
    client.setQueryData(queryKeys.auditEvents.all(), [])
    const added = await createRule(client, body)
    expect(added).toMatchObject(body)
    expect(client.getQueryState(queryKeys.rspamdRules.list({}))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.rspamdSettingsMap())?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.auditEvents.all())?.isInvalidated).toBe(true)
    client.clear()
  })

  it('checks without creating or changing, then creates, updates and deletes with version tags', async () => {
    useScenario('rspamd-rules-empty')
    const client = new QueryClient()
    expect(await validateNewRule(body)).toEqual({ valid: true })
    expect((await fetchRules({})).meta.total).toBe(0)
    const added = await createRule(client, body)
    expect((await fetchEffectiveMap()).content).toContain(`additional_settings_${added.id}`)
    expect(await validateRule(added, { content: 'apply { symbols=[]; }' })).toEqual({ valid: true })
    expect((await fetchRule(added.id)).etag).toBe(added.etag)
    const changed = await updateRule(client, added, { active: false, description: 'Updated' })
    expect(changed.active).toBe(false)
    expect(changed.etag).not.toBe(added.etag)
    expect((await fetchEffectiveMap()).content).not.toContain(`additional_settings_${added.id}`)
    await expect(updateRule(client, added, { description: 'Stale' })).rejects.toMatchObject({
      status: 412,
    })
    await expect(deleteRule(client, added)).rejects.toMatchObject({ status: 412 })
    await deleteRule(client, changed)
    await expect(fetchRule(added.id)).rejects.toMatchObject({ status: 404 })
    client.clear()
  })

  it('reports the exact structural opener and accepts quoted/comment/heredoc braces', async () => {
    useScenario('rspamd-rules-empty')
    await expect(
      validateNewRule({ ...body, content: '# header\napply {\n  symbols=[];' }),
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: new Map([
        [
          'content',
          [
            expect.objectContaining({
              code: 'unbalancedStructure',
              params: { line: 2, construct: 'unclosedBrace' },
            }),
          ],
        ],
      ]),
    })
    expect(
      await validateNewRule({
        ...body,
        content: '# {\napply { text="{ ]"; /* [ */ value=<<TAG\n} ] {\nTAG\n}',
      }),
    ).toEqual({ valid: true })
    expect((await fetchRules({})).meta.total).toBe(0)
  })

  it.each(['settings-domain-admin', 'settings-mailbox-user'])(
    'refuses settings rules to %s',
    async (scenario) => {
      useScenario(scenario)
      await expect(fetchRules({})).rejects.toMatchObject({ status: 403 })
      await expect(validateNewRule(body)).rejects.toMatchObject({ status: 403 })
      await expect(fetchEffectiveMap()).rejects.toMatchObject({ status: 403 })
    },
  )

  it('limits Rspamd presets to admins and offers all Sieve examples to domain administrators', async () => {
    useScenario('settings-admin-defaults')
    expect(
      (await fetchPresets('rspamd')).some(
        (preset) => preset.translationKey === 'admin.rsettings_preset_4',
      ),
    ).toBe(true)
    expect((await fetchPresets('sieve')).map((preset) => preset.translationKey)).toEqual(
      Array.from({ length: 8 }, (_, index) => `mailbox.sieve_preset_${index + 1}`),
    )
    useScenario('settings-domain-admin')
    expect(await fetchPresets('sieve')).toHaveLength(8)
    await expect(fetchPresets('rspamd')).rejects.toMatchObject({ status: 403 })
    useScenario('settings-mailbox-user')
    await expect(fetchPresets('sieve')).rejects.toMatchObject({ status: 403 })
  })
})

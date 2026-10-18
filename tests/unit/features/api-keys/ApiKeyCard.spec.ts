// T127: an API key card (FR-064, FR-084): status and owner warnings in text, not colour only.
import { describe, expect, it } from 'vitest'

import ApiKeyCard from '@/features/api-keys/components/ApiKeyCard.vue'

import { scenarioKey } from '../../../mocks/scenarios/api-keys'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

async function mountCard(overrides: Parameters<typeof scenarioKey>[1] = {}) {
  const router = createTestRouter()
  await router.push('/api-keys')
  return mountWithApp(ApiKeyCard, {
    props: { apiKey: scenarioKey(7, overrides) },
    global: { plugins: [router] },
  })
}

describe('ApiKeyCard', () => {
  it('shows name, prefix, owner, access, status, expiry and last use', async () => {
    const wrapper = await mountCard({
      lastUsedAt: '2026-10-01T08:00:00Z',
      lastUsedFrom: '198.51.100.7',
    })
    const text = wrapper.text()
    expect(wrapper.get('a').text()).toBe('Billing 07')
    expect(wrapper.get('a').attributes('href')).toBe(`/ng/api-keys/${scenarioKey(7).id}`)
    expect(text).toContain(scenarioKey(7).prefix)
    expect(text).toContain('admin')
    expect(text).toContain('Administrator')
    expect(text).toContain('Read only')
    expect(text).toContain('Active')
    expect(text).toContain('Never')
    expect(text).toContain('198.51.100.7')
  })

  it('names the status in text with an icon', async () => {
    const wrapper = await mountCard({
      status: 'revoked',
      revokedAt: '2026-10-02T08:00:00Z',
      revokedBy: { username: 'admin' },
    })
    const badge = wrapper.get('[data-status]')
    expect(badge.text()).toBe('Revoked')
    expect(badge.find('svg[aria-hidden="true"]').exists()).toBe(true)
  })

  it('warns in text when the owner is deactivated or deleted', async () => {
    const warning = 'The owner is deactivated or deleted, so this key cannot be used.'
    const inactive = await mountCard({
      owner: { username: 'former', role: 'domainAdmin', active: false },
    })
    expect(inactive.text()).toContain(warning)
    const deleted = await mountCard({ owner: { username: 'olduser', role: null, active: false } })
    expect(deleted.text()).toContain('Deleted account')
    expect(deleted.text()).toContain(warning)
    expect((await mountCard()).text()).not.toContain(warning)
  })

  it('says when a key was never used', async () => {
    expect((await mountCard()).text()).toContain('Never used')
  })
})

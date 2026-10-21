// The API key pages as components (T124–T126 at unit level): the list with filters, sort and
// paging, the empty state, revocation with its conflicts, and creation with the one-time secret.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/api'
import { setSessionContext } from '@/app/session/context'
import ApiKeyCreatePage from '@/features/api-keys/pages/ApiKeyCreatePage.vue'
import ApiKeyDetailPage from '@/features/api-keys/pages/ApiKeyDetailPage.vue'
import ApiKeysPage from '@/features/api-keys/pages/ApiKeysPage.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { ELSEWHERE_KEY } from '../../../mocks/scenarios/api-keys'
import { installMatchMedia } from '../../support/media'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

afterEach(() => {
  settleConfirm(false)
  setSessionContext(null)
})

async function mountAt(path: string, component: object, props: Record<string, unknown> = {}) {
  const router = createTestRouter()
  await router.push(path)
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('test'),
  })
  const wrapper = mountWithApp(component, {
    props,
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('ApiKeysPage', () => {
  it('lists the keys as cards with the total, and filters through the address', async () => {
    useScenario('api-keys-many')
    const { wrapper, router } = await mountAt('/api-keys', ApiKeysPage)
    await vi.waitFor(() => expect(wrapper.findAll('article')).toHaveLength(25))
    expect(wrapper.text()).toContain('Showing 1 to 25 of 60 entries')
    const status = wrapper.findAll('select')[0]!
    await status.setValue('revoked')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ status: 'revoked' }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Showing 1 to 12 of 12 entries'))
    const clear = wrapper.findAll('button').find((b) => b.text() === 'Clear filters')
    await clear!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({}))
  })

  it('sorts by a column header of the table on wide screens', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    useScenario('api-keys-many')
    const { wrapper, router } = await mountAt('/api-keys', ApiKeysPage)
    await vi.waitFor(() => expect(wrapper.findAll('tbody tr')).toHaveLength(25))
    const first = wrapper.get('tbody tr')
    const edit = first.get('td:last-child .table-row-controls a')
    expect(edit.text()).toBe('Edit')
    expect(edit.attributes('href')).toBe(first.get('td:first-child a').attributes('href'))
    expect(first.find('td:last-child [aria-expanded]').exists()).toBe(false)
    const name = wrapper.findAll('th button').find((b) => b.text().startsWith('Name'))!
    await name.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ sort: 'name' }))
    expect(wrapper.get('th[aria-sort="ascending"]').text()).toContain('Name')
    await wrapper
      .findAll('th button')
      .find((b) => b.text().startsWith('Name'))!
      .trigger('click')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.query).toEqual({ sort: 'name', order: 'desc' }),
    )
    await wrapper.get('button[aria-label="Next"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.page).toBe('2'))
  })

  it('explains API keys when there are none', async () => {
    useScenario('api-keys-empty')
    const { wrapper } = await mountAt('/api-keys', ApiKeysPage)
    await vi.waitFor(() => expect(wrapper.find('[data-empty]').exists()).toBe(true))
    expect(wrapper.get('[data-empty]').text()).toContain('No API keys yet')
  })

  it('offers to clear filters that match nothing', async () => {
    useScenario('api-keys-empty')
    const { wrapper } = await mountAt('/api-keys?status=revoked', ApiKeysPage)
    await vi.waitFor(() => expect(wrapper.text()).toContain('No API keys match the filters.'))
  })
})

describe('ApiKeyDetailPage', () => {
  it('revokes after confirmation and shows the revocation', async () => {
    useScenario('api-key-revoked-elsewhere')
    const { wrapper } = await mountAt(`/api-keys/${ELSEWHERE_KEY.id}`, ApiKeyDetailPage, {
      apiKeyId: ELSEWHERE_KEY.id,
    })
    await vi.waitFor(() => expect(wrapper.find('h1').text()).toBe('Monitoring'))
    expect(wrapper.text()).toContain('192.0.2.0/24')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Revoke key')!
      .trigger('click')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Revoke Monitoring?'))
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Revoked by'))
    expect(wrapper.findAll('button').some((b) => b.text() === 'Revoke key')).toBe(false)
  })

  it('reloads a key changed elsewhere and lets the user try again', async () => {
    useScenario('api-key-revoked-elsewhere')
    const { wrapper } = await mountAt(`/api-keys/${ELSEWHERE_KEY.id}`, ApiKeyDetailPage, {
      apiKeyId: ELSEWHERE_KEY.id,
    })
    await vi.waitFor(() => expect(wrapper.find('h1').text()).toBe('Monitoring'))
    mockState().apiKeys[0]!.etag = '"ak-changed"'
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Revoke key')!
      .trigger('click')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.text()).toContain('This item was changed elsewhere.'))
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Revoke key')!
      .trigger('click')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Revoked by'))
  })

  it('says when a key does not exist', async () => {
    useScenario('api-keys-empty')
    const id = '01J9AK00000000000000000099'
    const { wrapper } = await mountAt(`/api-keys/${id}`, ApiKeyDetailPage, { apiKeyId: id })
    await vi.waitFor(() => expect(wrapper.text()).toContain('API key not found'))
  })
})

describe('ApiKeyCreatePage', () => {
  it('checks the fields before sending', async () => {
    useScenario('api-keys-empty')
    const { wrapper } = await mountAt('/api-keys/new', ApiKeyCreatePage)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('This field is required.')
    expect(mockState().requests.some((r) => r.operationId === 'createApiKey')).toBe(false)
  })

  it('creates the key, shows the secret once and keeps it out of the cache', async () => {
    useScenario('api-keys-empty', { signedInAs: 'admin' })
    testPlugins().queryClient.setQueryData(queryKeys.identity(), {
      username: 'admin',
      role: 'admin',
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    })
    const { wrapper, router } = await mountAt('/api-keys/new', ApiKeyCreatePage)
    expect((wrapper.get('input[role="combobox"]').element as HTMLInputElement).value).toBe('admin')
    await wrapper.get('input[type="text"]').setValue('Billing')
    await wrapper.get('form').trigger('submit')
    const field = () => document.querySelector<HTMLInputElement>('[role="dialog"] input')
    await vi.waitFor(() => expect(field()?.value).toMatch(/^mcv2_[A-Za-z0-9]{40}$/))
    const secret = field()!.value
    const cached = JSON.stringify(
      testPlugins()
        .queryClient.getQueryCache()
        .getAll()
        .map((q) => q.state.data),
    )
    expect(cached).not.toContain(secret)
    expect(cached).toContain('Billing')
    const buttons = () => [
      ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ]
    buttons()
      .find((b) => b.textContent?.includes('Copy'))!
      .click()
    await vi.waitFor(() =>
      expect(document.querySelector('[role="dialog"] [role="status"]')).not.toBeNull(),
    )
    buttons()
      .find((b) => b.textContent?.trim() === 'Close')!
      .click()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('api-key-detail'))
    expect(document.body.textContent).not.toContain(secret)
  })
})

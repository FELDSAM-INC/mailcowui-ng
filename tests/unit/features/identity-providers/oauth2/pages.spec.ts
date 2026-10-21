// The OAuth2 pages as components (T082 at unit level, FR-054 to FR-066): the list with the classic
// columns, search, sort, the states, single removal and the quick actions with one-time secrets;
// creation with the secret shown once; and the client page with its section save and conflicts.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { lt } from '@/i18n'
import { setSessionContext } from '@/app/session/context'
import Oauth2ClientCreatePage from '@/features/identity-providers/oauth2/pages/Oauth2ClientCreatePage.vue'
import Oauth2ClientDetailPage from '@/features/identity-providers/oauth2/pages/Oauth2ClientDetailPage.vue'
import Oauth2ClientsPage from '@/features/identity-providers/oauth2/pages/Oauth2ClientsPage.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../../mocks/node'
import { fixedClientId, scenarioClient } from '../../../../mocks/scenarios/oauth2-clients'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp, resetTestPlugins, testPlugins } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

afterEach(() => {
  resetTestPlugins()
  settleConfirm(false)
  setSessionContext(null)
  document.body.innerHTML = ''
})

async function mountAt(path: string, component: object) {
  const router = createTestRouter()
  await router.push(path)
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('test'),
  })
  const wrapper = mountWithApp(component, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

const button = (wrapper: { findAll: (s: string) => { text: () => string }[] }, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text) as unknown as {
    trigger: (e: string) => Promise<void>
  }

describe('Oauth2ClientsPage', () => {
  it('lists the clients as cards with the classic information, without secrets', async () => {
    useScenario('oauth2-many')
    const { wrapper } = await mountAt('/identity-providers/oauth2-apps', Oauth2ClientsPage)
    await vi.waitFor(() => expect(wrapper.findAll('[data-entry]')).toHaveLength(25))
    expect(wrapper.find('h1').text()).toBe(lt('admin.oauth2_apps'))
    expect(wrapper.find('[data-oauth2-info]').text()).toContain('/oauth/authorize')
    expect(wrapper.get('[data-entry="3"]').text()).toContain(fixedClientId(3))
    expect(wrapper.text()).not.toContain('f00d0003')
    expect(wrapper.text()).toContain('Showing 1 to 25 of 40 entries')
  })

  it('sorts from the table headers on wide screens and searches through the address', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    useScenario('oauth2-many')
    const { wrapper, router } = await mountAt('/identity-providers/oauth2-apps', Oauth2ClientsPage)
    await vi.waitFor(() => expect(wrapper.findAll('tbody tr')).toHaveLength(25))
    expect(wrapper.get('th[aria-sort="ascending"]').text()).toContain('ID')
    await wrapper.findAll('th button')[1]!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ sort: 'clientId' }))
    vi.useFakeTimers()
    const search = wrapper.get('input[type="search"]')
    await search.setValue('wiki')
    vi.advanceTimersByTime(600)
    vi.useRealTimers()
    await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBe('wiki'))
    await vi.waitFor(() => expect(wrapper.findAll('tbody tr')).toHaveLength(2))
  })

  it('shows the empty state and the error state with a retry', async () => {
    useScenario('oauth2-empty')
    const { wrapper } = await mountAt('/identity-providers/oauth2-apps', Oauth2ClientsPage)
    await vi.waitFor(() => expect(wrapper.text()).toContain(lt('datatables.emptyTable')))
    resetTestPlugins()
    useScenario('oauth2-many', { failures: { listOauth2Clients: { status: 500, times: 1 } } })
    const second = await mountAt('/identity-providers/oauth2-apps', Oauth2ClientsPage)
    await vi.waitFor(() => expect(second.wrapper.text()).toContain('The list could not be loaded.'))
    await button(second.wrapper, 'Try again').trigger('click')
    await vi.waitFor(() => expect(second.wrapper.findAll('[data-entry]')).toHaveLength(25))
  })

  it('removes one client after the classic confirmation, and asks again when it changed', async () => {
    useScenario('oauth2-changed-elsewhere')
    const { wrapper } = await mountAt('/identity-providers/oauth2-apps', Oauth2ClientsPage)
    await vi.waitFor(() => expect(wrapper.findAll('[data-entry]')).toHaveLength(2))
    mockState().oauth2Clients[0] = scenarioClient(1, { version: 5 })
    await wrapper
      .get(`[data-entry="1"] [data-row-action-trigger]`)
      .trigger('keydown', { key: 'Enter' })
    await flushPromises()
    document
      .querySelector<HTMLElement>(`[role="menuitem"][aria-label="Remove: ${fixedClientId(1)}"]`)!
      .click()
    await vi.waitFor(() => expect(confirmState.value?.title).toBe(lt('footer.confirm_delete')))
    settleConfirm(true)
    await vi.waitFor(() => expect(confirmState.value?.description).toContain('changed elsewhere'))
    settleConfirm(true)
    await vi.waitFor(() => expect(mockState().oauth2Clients.map((c) => c.id)).toEqual([2]))
  })

  it('renews the secrets of selected clients and shows each once, one after another', async () => {
    useScenario('oauth2-bulk-partial')
    const { wrapper } = await mountAt('/identity-providers/oauth2-apps', Oauth2ClientsPage)
    await vi.waitFor(() => expect(wrapper.findAll('[data-entry]')).toHaveLength(3))
    await button(wrapper, 'Select').trigger('click')
    for (const id of [1, 2]) {
      await wrapper.get(`input[aria-label="Select ${fixedClientId(id)}"]`).setValue(true)
    }
    await button(wrapper, lt('admin.oauth2_renew_secret')).trigger('click')
    expect(confirmState.value?.title).toBe(lt('admin.oauth2_renew_secret'))
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(`Client ID: ${fixedClientId(1)}`),
    )
    const first = (document.querySelector('[role="dialog"] input') as HTMLInputElement).value
    expect(first).toBe(mockState().oauth2Clients[0]!.clientSecret)
    expect(
      JSON.stringify(
        testPlugins()
          .queryClient.getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain(first)
  })
})

describe('Oauth2ClientCreatePage', () => {
  it('refuses an empty field, then shows the new secret once and leaves it out of the cache', async () => {
    useScenario('oauth2-empty')
    const { wrapper } = await mountAt('/identity-providers/oauth2-apps/new', Oauth2ClientCreatePage)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Redirect/Callback URL cannot be empty')
    await wrapper.get('input').setValue('https://wiki.example.org/oauth/callback')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Added client access'))
    const secret = mockState().oauth2Clients[0]!.clientSecret
    expect((document.querySelector('[role="dialog"] input') as HTMLInputElement).value).toBe(secret)
    expect(
      JSON.stringify(
        testPlugins()
          .queryClient.getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain(secret)
  })
})

describe('Oauth2ClientDetailPage', () => {
  it('shows the classic fields and saves the redirect URIs with the version tag', async () => {
    useScenario('oauth2-changed-elsewhere')
    const { wrapper, router } = await mountAt(
      '/identity-providers/oauth2-apps/1',
      Oauth2ClientDetailPage,
    )
    await vi.waitFor(() => expect(wrapper.text()).toContain(fixedClientId(1)))
    expect(wrapper.text()).toContain(lt('edit.scope'))
    expect(wrapper.text()).not.toContain(lt('edit.client_secret'))
    await router.push({ query: { edit: 'client' } })
    await flushPromises()
    await wrapper.get('form input').setValue('https://a.example.org/cb https://b.example.org/cb')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain(lt('success.object_modified', '1')))
    expect(mockState().oauth2Clients[0]!.redirectUris).toEqual([
      'https://a.example.org/cb',
      'https://b.example.org/cb',
    ])
  })

  it('keeps the input after an outdated save and lists the change', async () => {
    useScenario('oauth2-changed-elsewhere')
    const { wrapper, router } = await mountAt(
      '/identity-providers/oauth2-apps/1',
      Oauth2ClientDetailPage,
    )
    await vi.waitFor(() => expect(wrapper.text()).toContain(fixedClientId(1)))
    await router.push({ query: { edit: 'client' } })
    await flushPromises()
    await wrapper.get('form input').setValue('https://mine.example.org/cb')
    mockState().oauth2Clients[0] = scenarioClient(1, {
      redirectUris: ['https://theirs.example.org/cb'],
      version: 2,
    })
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    expect(wrapper.get('[data-outdated]').text()).toContain('https://theirs.example.org/cb')
    expect((wrapper.get('form input').element as HTMLInputElement).value).toBe(
      'https://mine.example.org/cb',
    )
    await button(wrapper, 'Discard my changes').trigger('click')
    await flushPromises()
    expect((wrapper.get('form input').element as HTMLInputElement).value).toBe(
      'https://theirs.example.org/cb',
    )
  })

  it('shows "not found" for a client that does not exist', async () => {
    useScenario('oauth2-empty')
    const { wrapper } = await mountAt('/identity-providers/oauth2-apps/7', Oauth2ClientDetailPage)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Back to the OAuth2 apps'))
  })
})

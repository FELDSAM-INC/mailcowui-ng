import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it } from 'vitest'
import { api, queryKeys, requireData } from '@/api'
import {
  loginPageOptions,
  appLinksOptions,
  updateLoginPage,
  updateAppLinks,
  invalidateBranding,
} from '@/features/system-settings/api/branding'
import { useScenario } from '../../../../mocks/node'

describe('Login page and app links generated API', () => {
  it('merges login flags with a stable version and publishes public configuration', async () => {
    useScenario('idp-none')
    const client = new QueryClient()
    const before = await client.fetchQuery(loginPageOptions())
    const saved = await updateLoginPage({ hideDomainAdminLogin: true }, before.etag)
    expect(saved).toMatchObject({ ...before, hideDomainAdminLogin: true, etag: expect.any(String) })
    expect(saved.etag).not.toBe(before.etag)
    expect(requireData(await api.GET('/public-config')).data.loginPage.hideDomainAdminLogin).toBe(
      true,
    )
    await expect(updateLoginPage({ hideAdminLogin: true }, before.etag)).rejects.toMatchObject({
      status: 412,
    })
    client.setQueryData(queryKeys.publicConfig(), {})
    await invalidateBranding(client)
    expect(client.getQueryState(queryKeys.publicConfig())?.isInvalidated).toBe(true)
    client.clear()
  })
  it('replaces only operator links and preserves built-ins in the public config', async () => {
    useScenario('app-links-three')
    const client = new QueryClient()
    const before = await client.fetchQuery(appLinksOptions())
    const links = [
      { name: '<b>Helpdesk</b>', url: '/help', signedInUrl: '/help?u=%u', showOnLoginPage: false },
    ]
    const saved = await updateAppLinks({ links }, before.etag)
    expect(saved.links).toEqual(links)
    expect(saved.builtInLinks).toEqual(before.builtInLinks)
    expect(requireData(await api.GET('/public-config')).data.appLinks).toEqual([
      ...before.builtInLinks,
      { ...links[0], source: 'operator', description: null },
    ])
    await expect(updateAppLinks({ links: [] }, before.etag)).rejects.toMatchObject({ status: 412 })
    client.clear()
  })
  it('returns indexed validation problems without storing any invalid row', async () => {
    useScenario('app-links-three')
    const client = new QueryClient()
    const before = await client.fetchQuery(appLinksOptions())
    await expect(
      updateAppLinks(
        {
          links: [
            { name: 'a\nb', url: 'javascript:alert(1)', signedInUrl: null, showOnLoginPage: true },
          ],
        },
        before.etag,
      ),
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: new Map([
        ['links.0.name', [expect.objectContaining({ params: { format: 'singleLine' } })]],
        ['links.0.url', [expect.objectContaining({ params: { format: 'appLinkUrl' } })]],
      ]),
    })
    expect((await client.fetchQuery({ ...appLinksOptions(), staleTime: 0 })).links).toEqual(
      before.links,
    )
    client.clear()
  })
  it.each(['settings-domain-admin', 'settings-mailbox-user'])(
    'denies settings for %s',
    async (name) => {
      useScenario(name)
      const client = new QueryClient()
      await expect(client.fetchQuery(loginPageOptions())).rejects.toMatchObject({ status: 403 })
      await expect(client.fetchQuery(appLinksOptions())).rejects.toMatchObject({ status: 403 })
      client.clear()
    },
  )
  it('refuses both mutations in demo mode', async () => {
    useScenario('settings-demo-mode')
    const client = new QueryClient()
    const login = await client.fetchQuery(loginPageOptions()),
      links = await client.fetchQuery(appLinksOptions())
    await expect(updateLoginPage({ hideAdminLogin: true }, login.etag)).rejects.toMatchObject({
      status: 403,
    })
    await expect(updateAppLinks({ links: [] }, links.etag)).rejects.toMatchObject({ status: 403 })
    client.clear()
  })
})

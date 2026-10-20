import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it } from 'vitest'
import { api, requireData } from '@/api'
import { brandColorsOptions, updateBrandColors } from '@/features/system-settings/api/branding'
import { useScenario } from '../../../../mocks/node'

describe('brand colour contract (T066)', () => {
  it('stores lower-case partial updates, publishes effective colours and rejects stale versions', async () => {
    useScenario('brand-colours-none')
    const client = new QueryClient()
    const before = await client.fetchQuery(brandColorsOptions())
    const light = await updateBrandColors({ light: '#1D4ED8' }, before.etag)
    expect(light).toMatchObject({
      light: '#1d4ed8',
      dark: null,
      effective: { light: { color: '#1d4ed8', foreground: '#ffffff' }, dark: null },
    })
    await expect(updateBrandColors({ dark: '#60a5fa' }, before.etag)).rejects.toMatchObject({
      status: 412,
    })
    const both = await updateBrandColors({ dark: '#60A5FA' }, light.etag)
    expect(both.effective.dark).toEqual({ color: '#60a5fa', foreground: '#000000' })
    expect(requireData(await api.GET('/public-config')).data.brandColors).toEqual(both.effective)
    const cleared = await updateBrandColors({ light: null, dark: null }, both.etag)
    expect(cleared.effective).toEqual({ light: null, dark: null })
    client.clear()
  })
  it('rejects insufficient contrast with API parameters and retains the previous colours', async () => {
    useScenario('brand-colours-set')
    const client = new QueryClient(),
      before = await client.fetchQuery(brandColorsOptions())
    await expect(updateBrandColors({ light: '#ffd700' }, before.etag)).rejects.toMatchObject({
      status: 422,
      fieldErrors: new Map([
        [
          'light',
          [
            expect.objectContaining({
              code: 'insufficientContrast',
              params: { ratio: 1.4, minimum: 4.5, surface: '#ffffff' },
            }),
          ],
        ],
      ]),
    })
    expect((await client.fetchQuery({ ...brandColorsOptions(), staleTime: 0 })).light).toBe(
      before.light,
    )
    client.clear()
  })
  it('uses capability reference surfaces for the light-to-dark fallback', async () => {
    useScenario('brand-colours-none', {
      settings: {
        capabilities: {
          brandColors: {
            lightReferenceSurface: '#ffffff',
            darkReferenceSurface: '#000000',
            minimumContrastRatio: 4.5,
          },
        },
      },
    })
    const client = new QueryClient(),
      before = await client.fetchQuery(brandColorsOptions())
    const saved = await updateBrandColors({ light: '#767676' }, before.etag)
    expect(saved.effective).toEqual({
      light: { color: '#767676', foreground: '#000000' },
      dark: { color: '#767676', foreground: '#000000' },
    })
    client.clear()
  })
  it('enforces demo and administrator-only access', async () => {
    useScenario('settings-demo-mode')
    const client = new QueryClient(),
      before = await client.fetchQuery(brandColorsOptions())
    await expect(updateBrandColors({ light: '#1d4ed8' }, before.etag)).rejects.toMatchObject({
      status: 403,
    })
    for (const scenario of ['settings-domain-admin', 'settings-mailbox-user']) {
      useScenario(scenario)
      await expect(
        client.fetchQuery({ ...brandColorsOptions(), staleTime: 0 }),
      ).rejects.toMatchObject({ status: 403 })
    }
    client.clear()
  })
})

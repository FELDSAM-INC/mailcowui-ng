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
      effective: {
        light: { color: '#1d4ed8', foreground: '#ffffff' },
        dark: { color: '#1d4ed8', foreground: '#ffffff' },
      },
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
  it('preserves bright accents and inherits the light colour when the dark colour is cleared', async () => {
    useScenario('brand-colours-set')
    const client = new QueryClient(),
      before = await client.fetchQuery(brandColorsOptions())
    const saved = await updateBrandColors({ light: '#FEBC23', dark: null }, before.etag)
    expect(saved.light).toBe('#febc23')
    expect(saved.effective).toEqual({
      light: { color: '#febc23', foreground: '#000000' },
      dark: { color: '#febc23', foreground: '#000000' },
    })
    expect(requireData(await api.GET('/public-config')).data.brandColors).toEqual(saved.effective)
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

import { Blob as NodeBlob } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it } from 'vitest'
import { api, queryKeys, requireData } from '@/api'
import {
  logoOptions,
  uiTextsOptions,
  replaceLogo,
  deleteLogo,
  updateUiTexts,
} from '@/features/system-settings/api/branding'
import { useScenario } from '../../../../mocks/node'

const image = (name: string) =>
  new NodeBlob([readFileSync(`tests/fixtures/logos/${name}`)]) as unknown as Blob
describe('Branding API and public configuration freshness (T052/T061)', () => {
  it('uploads raw detected content with the version tag and serves exactly those bytes', async () => {
    useScenario('branding-light-logo')
    const client = new QueryClient()
    const before = await client.fetchQuery(logoOptions('dark'))
    client.setQueryData(queryKeys.publicConfig(), {})
    expect(before.isSet).toBe(false)
    const saved = await replaceLogo(client, before, image('logo-300x80.png'), 'image/png')
    expect(saved).toMatchObject({
      variant: 'dark',
      isSet: true,
      mediaType: 'image/png',
      width: 300,
      height: 80,
    })
    expect(saved.etag).not.toBe(before.etag)
    expect(client.getQueryState(queryKeys.publicConfig())?.isInvalidated).toBe(true)
    const response = await fetch(new URL(saved.url!, location.origin))
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array(readFileSync('tests/fixtures/logos/logo-300x80.png')),
    )
    client.clear()
  })
  it('refuses unsafe SVG and stale deletion while preserving the stored logo', async () => {
    useScenario('branding-light-logo')
    const client = new QueryClient()
    const before = await client.fetchQuery(logoOptions('light'))
    await expect(
      replaceLogo(client, before, image('logo-script.svg'), 'image/svg+xml'),
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: new Map([
        [
          'body',
          [
            expect.objectContaining({
              code: 'unsafeSvgContent',
              params: { construct: 'scriptElement', line: 2 },
            }),
          ],
        ],
      ]),
    })
    expect((await client.fetchQuery({ ...logoOptions('light'), staleTime: 0 })).etag).toBe(
      before.etag,
    )
    const changed = await replaceLogo(client, before, image('logo.svg'), 'image/svg+xml')
    await expect(deleteLogo(client, before)).rejects.toMatchObject({ status: 412 })
    await deleteLogo(client, changed)
    expect((await client.fetchQuery({ ...logoOptions('light'), staleTime: 0 })).isSet).toBe(false)
    const config = requireData(await api.GET('/public-config')).data
    expect(config.logos.light.isDefault).toBe(true)
    client.clear()
  })
  it('merges only sent UI text fields and publishes plain text, HTML and announcement changes', async () => {
    useScenario('ui-texts-custom')
    const client = new QueryClient()
    const before = await client.fetchQuery(uiTextsOptions())
    const saved = await updateUiTexts(
      { productName: '<b>Acme & Co</b>', announcement: { active: false } },
      before.etag,
    )
    expect(saved).toMatchObject({
      productName: '<b>Acme & Co</b>',
      pageTitle: before.pageTitle,
      announcement: { ...before.announcement, active: false },
    })
    const config = requireData(await api.GET('/public-config')).data
    expect(config.productName).toBe('<b>Acme & Co</b>')
    expect(config.announcement.active).toBe(false)
    await expect(updateUiTexts({ footerHtml: 'stale' }, before.etag)).rejects.toMatchObject({
      status: 412,
    })
    client.clear()
  })
  it('validates single-line text and refuses branding changes in demo mode', async () => {
    useScenario('settings-admin-defaults')
    const client = new QueryClient()
    const before = await client.fetchQuery(uiTextsOptions())
    await expect(updateUiTexts({ productName: 'Two\nlines' }, before.etag)).rejects.toMatchObject({
      status: 422,
      fieldErrors: new Map([
        [
          'productName',
          [expect.objectContaining({ code: 'invalidFormat', params: { format: 'singleLine' } })],
        ],
      ]),
    })
    useScenario('settings-demo-mode')
    const demo = await client.fetchQuery({ ...uiTextsOptions(), staleTime: 0 })
    await expect(updateUiTexts({ productName: 'Demo change' }, demo.etag)).rejects.toMatchObject({
      status: 403,
    })
    const logo = await client.fetchQuery(logoOptions('light'))
    await expect(
      replaceLogo(client, logo, image('logo.svg'), 'image/svg+xml'),
    ).rejects.toMatchObject({ status: 403 })
    await expect(deleteLogo(client, logo)).rejects.toMatchObject({ status: 403 })
    client.clear()
  })
  it.each(['settings-domain-admin', 'settings-mailbox-user'])(
    'denies branding settings to %s',
    async (scenario) => {
      useScenario(scenario)
      const client = new QueryClient()
      await expect(client.fetchQuery(logoOptions('light'))).rejects.toMatchObject({ status: 403 })
      await expect(client.fetchQuery(uiTextsOptions())).rejects.toMatchObject({ status: 403 })
      client.clear()
    },
  )
})

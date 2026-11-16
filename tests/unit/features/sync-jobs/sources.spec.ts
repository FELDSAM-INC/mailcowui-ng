import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RouterView } from 'vue-router'
import { ref, defineComponent, h } from 'vue'
import SourceFields from '@/features/sync-jobs/sources/SourceFields.vue'
import { lt } from '@/i18n'
import SourcePicker from '@/features/sync-jobs/sources/SourcePicker.vue'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import SourceEditorPage from '@/features/sync-jobs/sources/SourceEditorPage.vue'
import { deleteSource, disconnect, type SyncSource } from '@/features/sync-jobs/sources/api'
import { sourceForm, sourcePatch } from '@/features/sync-jobs/sources/form'
import {
  checkValues,
  initialCreateValues,
  createBody,
  needsRemotePassword,
  patchFor,
  toFormValues,
} from '@/features/sync-jobs/form-model'
import { settleConfirm } from '@/shared/composables/useConfirm'
import { mockSyncJob, syncJobCapabilities, syncJobView } from '../../../mocks/factories/sync-job'
import { server, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
import { installMatchMedia } from '../../support/media'
import { createTestRouter } from '../../support/router'

const fixture = (): SyncSource => ({
  id: 1,
  name: 'External IMAP',
  description: 'Shared connection',
  createdBy: 'admin',
  scope: 'all',
  domains: [],
  users: [],
  remoteHost: 'imap.example.org',
  remotePort: 993,
  encryption: 'ssl',
  verifyCertificate: true,
  authMechanism: 'plain',
  active: true,
  editable: true,
  oauth: null,
  etag: '"source-v1"',
})
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  settleConfirm(false)
})
async function open(data = fixture()) {
  installMatchMedia({ '(min-width: 768px)': true })
  useScenario('sync-jobs-admin')
  server.use(http.get('*/api/v2/sync-sources/1', () => HttpResponse.json({ data })))
  const router = createTestRouter()
  router.removeRoute('sync-source-detail')
  router.addRoute({
    name: 'sync-source-detail',
    path: '/sync-sources/:sourceId',
    component: SourceEditorPage,
  })
  await router.push('/sync-sources/1')
  wrapper = mountWithApp(RouterView, { attachTo: document.body, global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper!.find('#section-sync-source').exists()).toBe(true))
  return wrapper
}
async function edit(page: VueWrapper) {
  const button = page
    .findAll('button')
    .find((b) => b.attributes('aria-label')?.startsWith('Edit '))!
  await button.trigger('click')
  await flushPromises()
}
describe('Sync sources', () => {
  it('keeps upstream password-provider advice and explains OAuth only for OAuth presets', async () => {
    useScenario('sync-jobs-admin')
    wrapper = mountWithApp(SourceFields, {
      props: { modelValue: sourceForm(), role: 'admin', creating: true, errorsFor: () => [] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain(lt('syncjobs.source_presets_hint'))
    await wrapper.get('#source-preset').setValue('microsoftUser')
    expect(wrapper.text()).not.toContain(lt('syncjobs.source_presets_hint'))
    expect(wrapper.text()).toContain('OAuth')
    await wrapper.get('#source-preset').setValue('gmail')
    expect(wrapper.text()).toContain(lt('syncjobs.source_presets_hint'))
  })
  it('loads reusable source settings and discards a typed password when choosing OAuth', async () => {
    useScenario('sync-jobs-admin')
    server.use(
      http.get('*/api/v2/sync-sources/1', () =>
        HttpResponse.json({ data: { ...fixture(), authMechanism: 'xoauth2' } }),
      ),
    )
    const form = ref(initialCreateValues(syncJobCapabilities(), {}))
    form.value.remotePassword = 'DO_NOT_REUSE'
    const router = createTestRouter()
    await router.push('/sync-jobs/new')
    wrapper = mountWithApp(
      defineComponent({
        setup: () => () =>
          h(SourcePicker, {
            id: 'source-picker',
            editing: false,
            errors: [],
            modelValue: form.value,
            'onUpdate:modelValue': (value) => {
              form.value = value
            },
          }),
      }),
      { global: { plugins: [router] } },
    )
    wrapper.getComponent(DomainPicker).vm.$emit('update:modelValue', '1')
    await vi.waitFor(() => expect(form.value.sourceOAuth).toBe(true))
    expect(form.value.remotePassword).toBe('')
    expect(form.value).toMatchObject({
      sourceId: 1,
      remoteHost: 'imap.example.org',
      remotePort: '993',
      encryption: 'ssl',
    })
    wrapper.getComponent(DomainPicker).vm.$emit('update:modelValue', null)
    await flushPromises()
    expect(form.value.sourceId).toBeUndefined()
    expect(form.value.sourceOAuth).toBe(false)
  })
  it('fetches source choices with inactive sources marked unavailable', async () => {
    useScenario('sync-jobs-admin')
    const reads: URL[] = []
    server.use(
      http.get('*/api/v2/sync-sources', ({ request }) => {
        reads.push(new URL(request.url))
        return HttpResponse.json({
          data: [{ ...fixture(), active: false }],
          meta: { total: 1, offset: 0, limit: 25 },
        })
      }),
    )
    const router = createTestRouter()
    await router.push('/sync-jobs/new')
    wrapper = mountWithApp(SourcePicker, {
      props: {
        id: 'source-picker',
        editing: false,
        errors: [],
        modelValue: initialCreateValues(syncJobCapabilities(), {}),
      },
      global: { plugins: [router] },
    })
    const picker = wrapper.getComponent(DomainPicker)
    const result = await picker
      .props('sources')[0]!
      .fetchPage({ q: 'External', offset: 0, limit: 25 })
    expect(reads[0]?.searchParams.get('q')).toBe('External')
    expect(result.items[0]).toMatchObject({ name: '1', nameUnicode: 'External IMAP', relay: true })
    const disabledReason = picker.props('disabledReason')
    const option = result.items[0]
    if (!disabledReason || !option) throw new Error('Source picker must expose its inactive option')
    expect(disabledReason(option)).toBeTruthy()
  })
  it('saves only changed values with the source version', async () => {
    const data = fixture(),
      requests: { body: unknown; etag: string | null }[] = []
    server.use(
      http.patch('*/api/v2/sync-sources/1', async ({ request }) => {
        requests.push({ body: await request.json(), etag: request.headers.get('If-Match') })
        return HttpResponse.json({ data: { ...data, description: 'Changed', etag: '"source-v2"' } })
      }),
    )
    const page = await open(data)
    await edit(page)
    await page.get('#source-description').setValue('Changed')
    await page.get('#section-sync-source form').trigger('submit')
    await vi.waitFor(() =>
      expect(requests).toEqual([{ body: { description: 'Changed' }, etag: '"source-v1"' }]),
    )
    await vi.waitFor(() => expect(page.find('#source-description').exists()).toBe(false))
  })
  it('retains the draft on a stale version and waits for an explicit retry', async () => {
    const data = fixture(),
      versions: (string | null)[] = []
    server.use(
      http.patch('*/api/v2/sync-sources/1', ({ request }) => {
        versions.push(request.headers.get('If-Match'))
        if (versions.length === 1) {
          data.etag = '"source-v2"'
          return HttpResponse.json(
            { type: 'about:blank', title: 'Precondition Failed', status: 412 },
            { status: 412, headers: { 'Content-Type': 'application/problem+json' } },
          )
        }
        return HttpResponse.json({ data })
      }),
    )
    const page = await open(data)
    await edit(page)
    await page.get('#source-description').setValue('My draft')
    await page.get('#section-sync-source form').trigger('submit')
    await vi.waitFor(() => expect(page.text()).toContain('Save again'))
    expect((page.get('#source-description').element as HTMLTextAreaElement).value).toBe('My draft')
    expect(versions).toEqual(['"source-v1"'])
    await page.get('#section-sync-source form').trigger('submit')
    await vi.waitFor(() => expect(versions).toEqual(['"source-v1"', '"source-v2"']))
  })
  it('escapes shared metadata and hides mutation controls on read-only sources', async () => {
    const page = await open({
      ...fixture(),
      editable: false,
      description: '<img src=x onerror=alert(1)>',
    })
    expect(page.text()).toContain('<img src=x onerror=alert(1)>')
    expect(page.find('img').exists()).toBe(false)
    expect(
      page.findAll('button').some((b) => b.attributes('aria-label')?.startsWith('Edit ')),
    ).toBe(false)
  })
  it('accepts successful no-content delete and disconnect responses', async () => {
    useScenario('sync-jobs-admin')
    const calls: string[] = []
    server.use(
      http.delete('*/api/v2/sync-sources/1', ({ request }) => {
        calls.push(request.headers.get('If-Match')!)
        return new HttpResponse(null, { status: 204 })
      }),
      http.delete('*/api/v2/sync-sources/1/connections', async ({ request }) => {
        const body = await request.json()
        calls.push(JSON.stringify(body))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await expect(deleteSource(1, '"v1"')).resolves.toBeUndefined()
    await expect(disconnect(1, 'anna@example.org', 'remote@example.net')).resolves.toBeUndefined()
    expect(calls).toEqual([
      '"v1"',
      JSON.stringify({ mailbox: 'anna@example.org', remoteUser: 'remote@example.net' }),
    ])
  })
  it('never sends a blank stored client secret or unrelated OAuth settings', () => {
    const data: SyncSource = {
      ...fixture(),
      authMechanism: 'xoauth2',
      oauth: {
        flow: 'client_credentials',
        tokenEndpoint: 'https://provider.example/token',
        authorizationEndpoint: null,
        userInfoEndpoint: null,
        clientId: 'client',
        scope: 'IMAP',
        extraParameters: {},
        clientSecretSet: true,
        tokenSet: true,
        tokenExpiresAt: null,
        refreshFailed: false,
        redirectUri: 'https://mail.example/sync-sources/oauth/return',
      },
    }
    const form = sourceForm(data)
    form.description = 'Metadata only'
    expect(sourcePatch(form, data)).toEqual({ description: 'Metadata only' })
    form.oauth.clientSecret = 'NEW_SECRET'
    expect(sourcePatch(form, data)).toEqual({
      description: 'Metadata only',
      oauth: { clientSecret: 'NEW_SECRET' },
    })
  })
  it('does not send retained passwords to OAuth sources and requires a new password when changing back', () => {
    const job = {
      ...syncJobView(mockSyncJob({ id: 9, mailbox: 'anna@example.org' })),
      sourceId: 1,
      priority: 0,
    }
    const form = toFormValues(job)
    form.sourceId = 2
    form.sourceOAuth = true
    form.remotePassword = 'OLD_SECRET'
    const options = { sendMailbox: true, customParamsAllowed: true }
    expect(createBody(form, options)).toMatchObject({ sourceId: 2, remoteUser: job.remoteUser })
    expect(createBody(form, options)).not.toHaveProperty('remotePassword')
    expect(createBody(form, options)).not.toHaveProperty('remoteHost')
    expect(patchFor(job, form, options)).toEqual({ sourceId: 2 })
    const oauthJob = { ...job, sourceAuthMechanism: 'xoauth2' as const, remotePasswordSet: false }
    form.sourceOAuth = false
    form.remotePassword = ''
    const passwordRequired = needsRemotePassword(oauthJob, patchFor(oauthJob, form, options))
    expect(passwordRequired).toBe(true)
    expect(
      checkValues(form, syncJobCapabilities(), {
        mode: 'edit',
        needsMailbox: false,
        passwordRequired,
      }).remotePassword,
    ).toBeDefined()
  })
})

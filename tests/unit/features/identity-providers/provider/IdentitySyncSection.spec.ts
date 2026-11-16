import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import IdentitySyncSection from '@/features/identity-providers/provider/components/IdentitySyncSection.vue'
import type { IdentitySyncStatus } from '@/features/identity-providers/provider/synchronisation-api'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { server, useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'
import { installMatchMedia } from '../../../support/media'

const fixture = (): IdentitySyncStatus => ({
  supported: true,
  provider: 'ldap',
  canSync: true,
  enabled: false,
  etag: '"sync-v1"',
  settings: {
    offboarding: false,
    offboardingLimit: 10,
    groupSync: false,
    groupAutocreate: true,
    groupDefaultDomain: '',
    groupPaths: [],
    idAttribute: '',
    disabledFilter: '',
    groupBaseDn: '',
    groupFilter: '',
    groupNameAttribute: 'cn',
    groupMemberMode: 'memberof',
    groupMemberAttribute: 'member',
  },
  counts: { accounts: 10, linked: 8, disabled: 1, missing: 1 },
  runs: [
    {
      id: 5,
      provider: 'ldap',
      mode: 'preview',
      status: 'blocked',
      requestedBy: 'admin',
      createdAt: '2026-11-16T10:00:00Z',
      startedAt: null,
      finishedAt: null,
      summary: {
        blocked: true,
        details: { conflicts: ['<img src=x onerror=alert(1)>'] },
        counts: { deactivate: 10 },
      },
    },
  ],
})
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  settleConfirm(false)
})
const button = (text: string) =>
  wrapper!.findAll('button').find((item) => item.text().trim() === text)!
async function open(data = fixture(), wide = true) {
  installMatchMedia({ '(min-width: 768px)': wide })
  useScenario('idp-ldap')
  server.use(
    http.get('*/api/v2/identity-provider/synchronisation', () => HttpResponse.json({ data })),
  )
  wrapper = mountWithApp(IdentitySyncSection, { attachTo: document.body })
  await vi.waitFor(() =>
    expect(wrapper!.find('#section-identity-sync').exists()).toBe(data.canSync),
  )
  await flushPromises()
  return wrapper
}

describe('Identity synchronisation', () => {
  it('saves only changed settings with the version read', async () => {
    const data = fixture()
    const saved: { body: unknown; etag: string | null }[] = []
    server.use(
      http.patch('*/api/v2/identity-provider/synchronisation', async ({ request }) => {
        const body = (await request.json()) as Partial<IdentitySyncStatus['settings']>
        saved.push({ body, etag: request.headers.get('If-Match') })
        data.settings = { ...data.settings, ...body }
        data.etag = '"sync-v2"'
        return HttpResponse.json({ data })
      }),
    )
    const page = await open(data)
    await page.get('button[aria-label="Edit Identity synchronisation"]').trigger('click')
    await page.get('#identity-sync-offboarding').setValue(true)
    await page.get('#section-identity-sync form').trigger('submit')
    await vi.waitFor(() =>
      expect(saved).toEqual([{ body: { offboarding: true }, etag: '"sync-v1"' }]),
    )
    await vi.waitFor(() => expect(page.find('#identity-sync-offboarding').exists()).toBe(false))
    expect(page.emitted('dirty')?.flat()).toContain(true)
  })

  it('keeps the draft after a stale save and sends the new version only after Save again', async () => {
    const data = fixture()
    let calls = 0
    const versions: (string | null)[] = []
    server.use(
      http.patch('*/api/v2/identity-provider/synchronisation', ({ request }) => {
        calls++
        versions.push(request.headers.get('If-Match'))
        if (calls === 1) {
          data.etag = '"sync-v2"'
          return HttpResponse.json(
            { type: 'about:blank', title: 'Precondition Failed', status: 412 },
            { status: 412, headers: { 'Content-Type': 'application/problem+json' } },
          )
        }
        return HttpResponse.json({ data })
      }),
    )
    const page = await open(data)
    await page.get('button[aria-label="Edit Identity synchronisation"]').trigger('click')
    await page.get('#identity-sync-offboardingLimit').setValue('25')
    await page.get('#section-identity-sync form').trigger('submit')
    await vi.waitFor(() => expect(button('Save again')).toBeTruthy())
    expect((page.get('#identity-sync-offboardingLimit').element as HTMLInputElement).value).toBe(
      '25',
    )
    expect(calls).toBe(1)
    await page.get('#section-identity-sync form').trigger('submit')
    await vi.waitFor(() => expect(versions).toEqual(['"sync-v1"', '"sync-v2"']))
  })

  it('confirms forced runs and does not post when the dialog is cancelled', async () => {
    const posted: unknown[] = []
    const data = fixture()
    server.use(
      http.post('*/api/v2/identity-provider/synchronisation/runs', async ({ request }) => {
        posted.push(await request.json())
        return HttpResponse.json({ data: data.runs[0] }, { status: 202 })
      }),
    )
    await open(data)
    await button('Force synchronisation').trigger('click')
    expect(confirmState.value?.acknowledge).toBeTruthy()
    settleConfirm(false)
    await flushPromises()
    expect(posted).toEqual([])
    await button('Force synchronisation').trigger('click')
    settleConfirm(true)
    await vi.waitFor(() => expect(posted).toEqual([{ mode: 'force', confirmForce: true }]))
  })

  it('uses compact cards and hides run details until expanded on mobile', async () => {
    const page = await open(fixture(), false)
    expect(page.find('table').exists()).toBe(false)
    expect(page.find('[data-card]').exists()).toBe(true)
    expect(page.text()).not.toContain('<img src=x')
    await page.get('[data-card-expand]').trigger('click')
    expect(page.text()).toContain('<img src=x onerror=alert(1)>')
    expect(page.find('img').exists()).toBe(false)
  })

  it('offers sorting, column selection, refresh and details at the end of desktop rows', async () => {
    const page = await open()
    expect(page.find('[data-list-columns]').exists()).toBe(true)
    expect(page.find('[data-refresh]').exists()).toBe(true)
    expect(page.find('[data-sort="created"]').exists()).toBe(true)
    expect(page.find('tbody tr td:last-child [data-row-expand]').exists()).toBe(true)
    await page.get('[data-row-expand]').trigger('click')
    expect(page.text()).toContain('The change limit stopped this run.')
  })

  it('keeps new controls unavailable on an old schema', async () => {
    const data = fixture()
    data.supported = false
    data.canSync = false
    data.runs = []
    const page = await open(data)
    expect(page.find('button').exists()).toBe(false)
  })
})

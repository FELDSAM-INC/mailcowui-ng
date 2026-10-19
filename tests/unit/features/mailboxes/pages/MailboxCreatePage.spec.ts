// The add mailbox page (UI 003 T063 under the forms rule): legacy's fields in legacy's order, the
// Default template applied and the quota following the domain, the request with only the values
// that differ from the template, the creation through `useSecretRequest` with legacy's message on
// the new mailbox's page, errors kept on their fields, and the creation report's failed steps.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setSessionContext } from '@/app/session/context'
import { checkCreate, createFieldId } from '@/features/mailboxes/create-form'
import { creationFlashes } from '@/features/mailboxes/creation-report'
import { takeMailboxFlash } from '@/features/mailboxes/flash'
import { valuesFrom } from '@/features/mailboxes/form-values'
import MailboxCreatePage from '@/features/mailboxes/pages/MailboxCreatePage.vue'
import type { MailboxCreated } from '@/features/mailboxes/types'
import { createAppChannel } from '@/shared/platform/broadcast'
import type { ClientErrors } from '@/shared/validation/client-errors'

import { defaultMailboxCapabilities } from '../../../../mocks/scenarios/mailboxes/base'
import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp, testPlugins } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

const GIB = 1024 ** 3

afterEach(() => setSessionContext(null))

async function mountAt(path: string) {
  const router = createTestRouter()
  await router.push(path)
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('test'),
  })
  const wrapper = mountWithApp(MailboxCreatePage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

const creates = () => mockState().requests.filter((r) => r.operationId === 'createMailbox')

describe('checkCreate', () => {
  const values = () => valuesFrom(defaultMailboxCapabilities().templateDefaults)
  const fields = {
    localPart: ' Anna.Smith ',
    displayName: '',
    domain: 'example.org',
    password: 'secret-1',
    password2: 'secret-1',
  }

  it('checks the essentials, the quota against the domain and the rate limit', () => {
    const errors = {}
    expect(
      checkCreate(
        errors,
        fields,
        { ...values(), quota: '1024' },
        {
          maxQuota: 5 * GIB,
          unlimitedAllowed: true,
        },
      ),
    ).toEqual({ quota: GIB, rateLimit: null })
    const refused: ClientErrors = {}
    expect(
      checkCreate(
        refused,
        { ...fields, localPart: '', domain: null, password2: 'other' },
        { ...values(), quota: '8192', rateLimitValue: 'x' },
        { maxQuota: 5 * GIB, unlimitedAllowed: true },
      ),
    ).toBeNull()
    expect(Object.keys(refused).sort()).toEqual([
      'domain',
      'localPart',
      'password2',
      'quota',
      'rateLimit',
    ])
  })

  it('accepts only 0 when the domain has no quota left', () => {
    expect(
      checkCreate(
        {},
        fields,
        { ...values(), quota: '0' },
        { maxQuota: 0, unlimitedAllowed: false },
      ),
    ).toMatchObject({ quota: 0 })
  })

  it('maps problem paths to the form’s controls', () => {
    expect(createFieldId('x', 'localPart')).toBe('x-localPart')
    expect(createFieldId('x', 'templateId')).toBe('x-template')
    expect(createFieldId('x', 'protocolAccess.imap')).toBe('x-protocols')
  })
})

describe('creationFlashes', () => {
  it('reports legacy’s success and each failed follow-up step', () => {
    const created = {
      address: 'a@example.org',
      creationReport: {
        groupwareDirectoryUpdate: 'done',
        rateLimit: 'failed',
        taggedMailHandling: 'notRequested',
      },
    } as unknown as MailboxCreated
    expect(creationFlashes(created)).toEqual([
      { kind: 'success', text: { legacy: 'success.mailbox_added', args: ['a@example.org'] } },
      { kind: 'warning', text: 'mailboxes.creationReport.rateLimit' },
    ])
  })
})

describe('MailboxCreatePage', () => {
  it('shows legacy’s fields in order with the Default template and the quota of the domain', async () => {
    useScenario('admin-create')
    const { wrapper } = await mountAt('/mailboxes/new?domain=example.org')
    await vi.waitFor(() => expect(wrapper.find('[data-mailbox-form]').exists()).toBe(true))
    const labels = wrapper
      .findAll('label')
      .map((label) => label.text().replace('(required)', '').trim())
      .slice(0, 5)
    expect(labels).toEqual([
      'Username (left part of an email address)',
      'Full name',
      'Domain',
      'Template',
      'Password',
    ])
    await vi.waitFor(() =>
      expect((wrapper.get('#mailbox-add-quota').element as HTMLInputElement).value).toBe('5120'),
    )
    expect(wrapper.text()).toContain('max. 5,120 MiB')
    expect(wrapper.text()).toContain('@example.org')
  })

  it('creates the mailbox with only the changed values and opens it with legacy’s message', async () => {
    useScenario('admin-create')
    const { wrapper, router } = await mountAt('/mailboxes/new?domain=example.org')
    await vi.waitFor(() => expect(wrapper.find('[data-mailbox-form]').exists()).toBe(true))
    await vi.waitFor(() =>
      expect((wrapper.get('#mailbox-add-quota').element as HTMLInputElement).value).toBe('5120'),
    )
    await wrapper.get('#mailbox-add-localPart').setValue('new.user')
    await wrapper.get('#mailbox-add-password').setValue('Secret-123')
    await wrapper.get('#mailbox-add-password2').setValue('Secret-123')
    await wrapper.get('#mailbox-add-quota').setValue('1024')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('mailbox-detail'))
    expect(router.currentRoute.value.params.address).toBe('new.user@example.org')
    const body = creates()[0]?.body as Record<string, unknown>
    expect(body).toEqual({
      localPart: 'new.user',
      domain: 'example.org',
      templateId: 1,
      quota: GIB,
      password: '[redacted]',
    })
    const [flash] = takeMailboxFlash('new.user@example.org')
    expect(flash).toEqual({
      kind: 'success',
      text: { legacy: 'success.mailbox_added', args: ['new.user@example.org'] },
    })
  })

  it('names the holder of a taken address on the field and keeps every entry', async () => {
    useScenario('admin-create')
    const { wrapper, router } = await mountAt('/mailboxes/new?domain=example.org')
    await vi.waitFor(() => expect(wrapper.find('[data-mailbox-form]').exists()).toBe(true))
    await vi.waitFor(() =>
      expect((wrapper.get('#mailbox-add-quota').element as HTMLInputElement).value).toBe('5120'),
    )
    await wrapper.get('#mailbox-add-localPart').setValue('anna')
    await wrapper.get('#mailbox-add-password').setValue('Secret-123')
    await wrapper.get('#mailbox-add-password2').setValue('Secret-123')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.get('#mailbox-add-localPart-error').text()).toContain('anna@example.org'),
    )
    expect(router.currentRoute.value.name).toBe('mailbox-create')
    expect((wrapper.get('#mailbox-add-password').element as HTMLInputElement).value).toBe(
      'Secret-123',
    )
  })

  it('reports a full domain for the whole form', async () => {
    useScenario('admin-create')
    const { wrapper } = await mountAt('/mailboxes/new?domain=full.example')
    await vi.waitFor(() => expect(wrapper.find('[data-mailbox-form]').exists()).toBe(true))
    await vi.waitFor(() =>
      expect((wrapper.get('#mailbox-add-quota').element as HTMLInputElement).value).toBe('1024'),
    )
    await wrapper.get('#mailbox-add-localPart').setValue('second')
    await wrapper.get('#mailbox-add-password').setValue('Secret-123')
    await wrapper.get('#mailbox-add-password2').setValue('Secret-123')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-form-error]').exists()).toBe(true))
    expect(wrapper.get('[data-form-error]').text()).toContain('1')
  })
})

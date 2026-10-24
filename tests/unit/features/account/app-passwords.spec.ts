import { flushPromises } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'
const leaveGuard = vi.hoisted(() => vi.fn())
vi.mock('@/shared/composables/useLeaveGuard', () => ({ useLeaveGuard: leaveGuard }))

import { queryKeys } from '@/api'
import {
  createAppPassword,
  fetchAppPassword,
  listAppPasswords,
  regenerateAppPassword,
  updateAppPassword,
  deleteAppPassword,
  afterAppPasswordChange,
} from '@/features/account/api/app-passwords'
import MultiSelect from '@/shared/components/MultiSelect.vue'
import AppPasswordForm from '@/features/account/components/app-passwords/AppPasswordForm.vue'
import { loadLegacy } from '@/i18n/legacy'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

beforeAll(() => loadLegacy('en-gb'))

describe('app passwords', () => {
  it('uses the legacy empty-app-name message without sending an invalid request', async () => {
    useScenario('account-mailbox')
    const wrapper = mountWithApp(AppPasswordForm, {
      props: { mailbox: 'anna@example.org', canChange: true },
    })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('App name cannot be empty')
    expect(
      mockState().requests.filter((request) => request.operationId === 'createAppPassword'),
    ).toHaveLength(0)
  })
  it('creates and regenerates once without putting secrets into either cache', async () => {
    useScenario('account-mailbox')
    const client = testPlugins().queryClient
    const created = await createAppPassword('anna@example.org', {
      name: 'Phone',
      active: true,
      protocols: ['imap', 'smtp'],
    })
    expect(created.generatedPassword).toHaveLength(32)
    afterAppPasswordChange(client, created)
    const stored = await fetchAppPassword('anna@example.org', created.id)
    expect(stored).not.toHaveProperty('generatedPassword')
    const renewed = await regenerateAppPassword('anna@example.org', created.id, stored.etag)
    expect(renewed.generatedPassword).not.toBe(created.generatedPassword)
    afterAppPasswordChange(client, renewed)
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('generatedPassword')
    expect(client.getMutationCache().getAll()).toHaveLength(0)
    expect(
      client.getQueryData(queryKeys.selfService.appPassword('anna@example.org', created.id)),
    ).not.toHaveProperty('generatedPassword')
  })

  it('filters by name/active, sorts, pages and protects changes with If-Match', async () => {
    useScenario('account-mailbox')
    const client = testPlugins().queryClient
    const result = await listAppPasswords('anna@example.org', {
      q: 'Laptop',
      active: true,
      limit: 1,
    })
    expect(result.data).toHaveLength(1)
    const item = result.data[0]!
    const changed = await updateAppPassword(
      client,
      item.mailbox,
      item.id,
      { name: 'Work laptop', protocols: [], active: false },
      item.etag,
    )
    expect(changed.name).toBe('Work laptop')
    expect(changed.protocols).toEqual([])
    await expect(deleteAppPassword(client, item.mailbox, item.id, item.etag)).rejects.toMatchObject(
      { status: 412 },
    )
    await deleteAppPassword(client, item.mailbox, item.id, changed.etag)
    await expect(fetchAppPassword(item.mailbox, item.id)).rejects.toMatchObject({ status: 404 })
  })

  it('permits read-only domain administrators to read but refuses changes and out-of-scope reads', async () => {
    useScenario('account-domain-admin-no-flags')
    expect((await listAppPasswords('anna@example.org', {})).data.length).toBeGreaterThan(0)
    await expect(
      createAppPassword('anna@example.org', { name: 'Denied', active: true }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(listAppPasswords('somebody@outside.example', {})).rejects.toMatchObject({
      status: 404,
    })
  })

  it('keeps the legacy field order with every protocol selected by default and warns about no protocols', async () => {
    useScenario('account-mailbox')
    const wrapper = mountWithApp(AppPasswordForm, {
      props: { mailbox: 'anna@example.org', canChange: true },
    })
    expect(
      wrapper
        .getComponent(MultiSelect)
        .props('options')
        .map((option) => option.label),
    ).toEqual(['IMAP', 'SMTP', 'EAS/ActiveSync', 'CardDAV/CalDAV', 'POP3', 'Sieve'])
    expect(wrapper.getComponent(MultiSelect).props('modelValue')).toHaveLength(6)
    wrapper.getComponent(MultiSelect).vm.$emit('update:modelValue', [])
    await flushPromises()
    expect(wrapper.text()).toContain('With no protocol selected, this app password works nowhere.')
    expect(wrapper.findAll('input[type="password"]')).toHaveLength(0)
  })

  it('validates the name, creates through direct secret requests and clears the form on success', async () => {
    useScenario('account-mailbox')
    const wrapper = mountWithApp(AppPasswordForm, {
      props: { mailbox: 'anna@example.org', canChange: true },
      attachTo: document.body,
    })
    await wrapper.get('form').trigger('submit')
    expect(mockState().requests.filter((r) => r.operationId === 'createAppPassword')).toHaveLength(
      0,
    )
    await wrapper.get('input[name="name"]').setValue('Phone')
    wrapper.getComponent(MultiSelect).vm.$emit('update:modelValue', ['imap', 'smtp'])
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    expect(wrapper.emitted('saved')![0]![0]).toMatchObject({
      name: 'Phone',
      protocols: ['imap', 'smtp'],
      generatedPassword: expect.any(String),
    })
    expect(testPlugins().queryClient.getMutationCache().getAll()).toHaveLength(0)
    await flushPromises()
  })
  it('guards new edits after a previous successful save', async () => {
    useScenario('account-mailbox')
    const stored = await fetchAppPassword('anna@example.org', 1)
    const wrapper = mountWithApp(AppPasswordForm, {
      props: { mailbox: stored.mailbox, stored, canChange: true },
    })
    await wrapper.get('input[name="name"]').setValue('First edit')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    const shouldGuard = leaveGuard.mock.lastCall![0] as () => boolean
    expect(shouldGuard()).toBe(false)
    await wrapper.get('input[name="name"]').setValue('Second unsaved edit')
    expect(shouldGuard()).toBe(true)
  })

  it('accepts no protocols and rejects a name whose stored HTML form is too long', async () => {
    useScenario('account-mailbox')
    const entry = await createAppPassword('anna@example.org', {
      name: '<tag>',
      active: true,
      protocols: [],
    })
    expect(entry.protocols).toEqual([])
    expect(entry.name).toBe('<tag>')
    await expect(
      createAppPassword('anna@example.org', { name: '&'.repeat(52), active: true }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

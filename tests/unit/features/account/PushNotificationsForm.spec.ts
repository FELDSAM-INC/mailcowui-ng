import { beforeAll, expect, it, vi } from 'vitest'
import PushNotificationsForm from '@/features/account/components/push/PushNotificationsForm.vue'
import { loadFeatureMessages } from '@/i18n'
import { loadLegacy } from '@/i18n/legacy'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

vi.mock('@/shared/composables/useLeaveGuard', () => ({ useLeaveGuard: vi.fn() }))
beforeAll(async () => {
  await loadLegacy('en-gb')
  await loadFeatureMessages('account')
})

it('keeps credentials blank and omits them while preserving the custom sound and comma-separated senders', async () => {
  useScenario('pushover-configured')
  mockState().selfService.mailboxes['anna@example.org']!.push!.sound = 'custom_sound'
  const wrapper = mountWithApp(PushNotificationsForm, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await vi.waitFor(() => expect(wrapper.find('input[name="token"]').exists()).toBe(true))
  expect((wrapper.get('input[name="token"]').element as HTMLInputElement).value).toBe('')
  expect(wrapper.text()).toContain('A value is stored. Leave empty to keep it.')
  expect(wrapper.get('select[name="sound"]').text()).toContain('custom_sound')
  await wrapper.get('input[name="senders"]').setValue('one@example.org, two@example.org')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
  const sent = mockState().requests.find(
    (r) => r.operationId === 'replacePushNotificationSettings',
  )!.body
  expect(sent).toMatchObject({
    senders: ['one@example.org', 'two@example.org'],
    sound: 'custom_sound',
  })
  expect(sent).not.toHaveProperty('token')
  expect(sent).not.toHaveProperty('userKey')
})
it('validates credentials before submitting and uses legacy format messages', async () => {
  useScenario('pushover-unconfigured')
  const wrapper = mountWithApp(PushNotificationsForm, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await vi.waitFor(() => expect(wrapper.find('input[name="token"]').exists()).toBe(true))
  await wrapper.get('input[name="token"]').setValue('a'.repeat(29))
  await wrapper.get('form').trigger('submit')
  expect(wrapper.text()).toContain('Pushover token has a wrong format')
  expect(wrapper.text()).toContain('Pushover token and or key missing')
  expect(
    mockState().requests.filter((r) => r.operationId === 'replacePushNotificationSettings'),
  ).toHaveLength(0)
})

it('keeps the draft after a version conflict and saves again with the refreshed version', async () => {
  useScenario('pushover-configured')
  const wrapper = mountWithApp(PushNotificationsForm, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await vi.waitFor(() => expect(wrapper.find('input[name="title"]').exists()).toBe(true))
  await wrapper.get('input[name="title"]').setValue('My draft')
  const stored = mockState().selfService.mailboxes['anna@example.org']!.push!
  stored.title = 'Saved elsewhere'
  stored.version++
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
  await vi.waitFor(() => expect(wrapper.get('[data-outdated]').text()).toContain('Saved elsewhere'))
  expect((wrapper.get('input[name="title"]').element as HTMLInputElement).value).toBe('My draft')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
  expect(mockState().selfService.mailboxes['anna@example.org']!.push?.title).toBe('My draft')
})

it('never stores submitted credentials in query or mutation caches and clears the inputs after success', async () => {
  useScenario('pushover-unconfigured')
  const wrapper = mountWithApp(PushNotificationsForm, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await vi.waitFor(() => expect(wrapper.find('input[name="token"]').exists()).toBe(true))
  const token = 'SecureToken'.padEnd(30, 'x')
  const key = 'SecureUserKey'.padEnd(30, 'y')
  await wrapper.get('input[name="token"]').setValue(token)
  await wrapper.get('input[name="userKey"]').setValue(key)
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
  const cache = JSON.stringify({
    queries: testPlugins()
      .queryClient.getQueryCache()
      .getAll()
      .map((query) => query.state.data),
    mutations: testPlugins()
      .queryClient.getMutationCache()
      .getAll()
      .map((mutation) => mutation.state),
  })
  expect(cache).not.toContain(token)
  expect(cache).not.toContain(key)
  expect((wrapper.get('input[name="token"]').element as HTMLInputElement).value).toBe('')
  expect((wrapper.get('input[name="userKey"]').element as HTMLInputElement).value).toBe('')
})

it('shows stored values read-only when the mailbox flag forbids changes', async () => {
  useScenario('pushover-configured')
  const wrapper = mountWithApp(PushNotificationsForm, {
    props: { mailbox: 'anna@example.org', canChange: false, mailboxContext: true },
  })
  await vi.waitFor(() => expect(wrapper.find('input[name="title"]').exists()).toBe(true))
  expect(wrapper.get('input[name="title"]').attributes('disabled')).toBeDefined()
  expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  await wrapper.get('form').trigger('submit')
  expect(
    mockState().requests.filter((r) => r.operationId === 'replacePushNotificationSettings'),
  ).toHaveLength(0)
})

it('opens advanced settings for a server-side regex error', async () => {
  useScenario('pushover-configured')
  const wrapper = mountWithApp(PushNotificationsForm, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await vi.waitFor(() => expect(wrapper.find('input[name="senderPattern"]').exists()).toBe(true))
  await wrapper.get('input[name="senderPattern"]').setValue('/[/')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.text()).toContain('Invalid regex'))
  expect((wrapper.get('details').element as HTMLDetailsElement).open).toBe(true)
  expect(wrapper.get('input[name="senderPattern"]').attributes('aria-invalid')).toBe('true')
})

it('validates sender count and individual length before sending the replacement', async () => {
  useScenario('pushover-configured')
  const wrapper = mountWithApp(PushNotificationsForm, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await vi.waitFor(() => expect(wrapper.find('input[name="senders"]').exists()).toBe(true))
  await wrapper.get('input[name="senders"]').setValue('x'.repeat(256))
  await wrapper.get('form').trigger('submit')
  expect(wrapper.get('input[name="senders"]').attributes('aria-invalid')).toBe('true')
  expect(wrapper.text()).toContain('Enter at most 255 characters.')
  expect(
    mockState().requests.filter((r) => r.operationId === 'replacePushNotificationSettings'),
  ).toHaveLength(0)
})

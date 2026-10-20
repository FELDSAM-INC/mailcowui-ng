import { beforeAll, expect, it, vi } from 'vitest'
import GenerateAliasPanel from '@/features/account/components/temporary-aliases/GenerateAliasPanel.vue'
import { loadLegacy } from '@/i18n/legacy'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
import * as aliases from '@/features/account/api/temporary-aliases'
import { testPlugins } from '../../support/mount'
import { flushPromises } from '@vue/test-utils'

const leave = vi.hoisted(() => vi.fn())
vi.mock('@/shared/composables/useLeaveGuard', () => ({ useLeaveGuard: leave }))
beforeAll(() => loadLegacy('en-gb'))

it('defaults to one year, preserves legacy field order, and announces the created address', async () => {
  useScenario('temporary-aliases-empty')
  const wrapper = mountWithApp(GenerateAliasPanel, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await vi.waitFor(() => expect(wrapper.find('select[name="domain"]').exists()).toBe(true))
  expect(wrapper.findAll('select, input').map((field) => field.attributes('name'))).toEqual([
    'domain',
    'description',
    'validity',
  ])
  expect((wrapper.get('select[name="validity"]').element as HTMLSelectElement).value).toBe('8760')
  await wrapper.get('input[name="description"]').setValue('Shop')
  expect((leave.mock.lastCall![0] as () => boolean)()).toBe(true)
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.emitted('created')).toHaveLength(1))
  expect(wrapper.text()).toContain('@example.org')
  expect(wrapper.get('[data-new-alias]').text()).toContain(
    'Changes to mailbox anna@example.org have been saved',
  )
  expect((leave.mock.lastCall![0] as () => boolean)()).toBe(false)
})
it('maps rejected alias validity to the existing legacy message', async () => {
  useScenario('temporary-aliases-empty')
  const wrapper = mountWithApp(GenerateAliasPanel, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await vi.waitFor(() => expect(wrapper.find('select[name="validity"]').exists()).toBe(true))
  mockState().failures.createTemporaryAlias = {
    status: 422,
    type: 'validation-failed',
    times: 1,
    errors: {
      lifetimeHours: [
        { code: 'outOfRange', message: 'Rejected validity', params: { min: 1, max: 10 } },
      ],
    },
  }
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.text()).toContain('Please assign a period of validity'))
})
it('hides the sole domain choice and prevents unauthorized submission', async () => {
  useScenario('temporary-aliases-single-domain')
  const wrapper = mountWithApp(GenerateAliasPanel, {
    props: { mailbox: 'anna@example.org', canChange: false },
  })
  await vi.waitFor(() =>
    expect(mockState().requests.some((r) => r.operationId === 'listTemporaryAliasDomains')).toBe(
      true,
    ),
  )
  expect(wrapper.find('select[name="domain"]').exists()).toBe(false)
  await wrapper.get('form').trigger('submit')
  expect(mockState().requests.filter((r) => r.operationId === 'createTemporaryAlias')).toHaveLength(
    0,
  )
})

it('sends only once while pending and discards a late result from a different mailbox context', async () => {
  useScenario('account-admin')
  const created = await aliases.createTemporaryAlias(
    testPlugins().queryClient,
    'anna@example.org',
    {
      domain: 'example.org',
    },
  )
  let finish!: (value: typeof created) => void
  const pending = new Promise<typeof created>((resolve) => {
    finish = resolve
  })
  const send = vi.spyOn(aliases, 'createTemporaryAlias').mockReturnValueOnce(pending)
  const wrapper = mountWithApp(GenerateAliasPanel, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await vi.waitFor(() => expect(wrapper.find('select[name="validity"]').exists()).toBe(true))
  await wrapper.get('form').trigger('submit')
  await wrapper.get('form').trigger('submit')
  expect(send).toHaveBeenCalledTimes(1)
  await wrapper.setProps({ mailbox: 'alice@example.org' })
  finish(created)
  await flushPromises()
  expect(wrapper.emitted('created')).toBeUndefined()
  expect(wrapper.find('[data-new-alias]').exists()).toBe(false)
  send.mockRestore()
})

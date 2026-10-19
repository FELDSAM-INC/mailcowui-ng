import { afterEach, describe, expect, it } from 'vitest'

import { fetchQuarantineItems } from '@/features/quarantine/api'
import { askQuarantineBulk } from '@/features/quarantine/bulk-confirmations'
import QuarantineBulkConfirm from '@/features/quarantine/components/bulk/QuarantineBulkConfirm.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

afterEach(() => settleConfirm(false))
async function items() {
  useScenario('quarantine-mailbox-user')
  return (await fetchQuarantineItems({ limit: 50 })).data
}

describe('quarantine bulk confirmations', () => {
  it.each(['delete', 'learnAsSpam'] as const)(
    'requires the number of targets for %s',
    async (action) => {
      const entries = (await items()).slice(0, 2)
      const pending = askQuarantineBulk(action, entries)
      expect(confirmState.value?.title).toBe('Confirm deletion')
      expect(confirmState.value?.destructive).toBe(true)
      expect(confirmState.value?.requireTyped?.accepted).toEqual(['2'])
      expect(confirmState.value?.acknowledge).toBeUndefined()
      settleConfirm(true)
      await expect(pending).resolves.toBe(true)
    },
  )

  it.each(['release', 'releaseWithoutLearning'] as const)(
    'confirms %s and requires acknowledgement when viruses are included',
    async (action) => {
      const entries = (await items()).slice(0, 2).map((item) => ({ ...item, virus: true }))
      const pending = askQuarantineBulk(action, entries)
      expect(confirmState.value?.requireTyped).toBeUndefined()
      expect(confirmState.value?.acknowledge?.label).toBe(
        '2 of the selected items contain a virus.',
      )
      settleConfirm(false)
      await expect(pending).resolves.toBe(false)
    },
  )

  it('shows subjects and recipients as inert text, with the virus count', async () => {
    const entries = (await items()).slice(0, 1).map((item) => ({
      ...item,
      virus: true,
      subject: '<img src=x onerror=alert(1)>',
      recipient: 'victim@example.org',
    }))
    const wrapper = mountWithApp(QuarantineBulkConfirm, {
      props: { items: entries, destructive: false },
    })
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.text()).toContain('victim@example.org')
    expect(wrapper.text()).toContain('1 of the selected items contain a virus.')
    expect(wrapper.find('img').exists()).toBe(false)
    wrapper.unmount()
  })
})

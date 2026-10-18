// Saving one section of the domain page (UI 002 T058, research D11, data-model §7): every outcome
// of the section edit state machine.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'

import { queryKeys, type Domain } from '@/api'
import { fetchDomain } from '@/features/domains/api'
import { useDomainSectionSave } from '@/features/domains/composables/useDomainSectionSave'

import { mockDomain, GIB } from '../../../mocks/factories/domain'
import { mockState, useScenario } from '../../../mocks/node'
import { assignDomains } from '../../../mocks/scenarios/domains-base'
import { mountWithApp, testPlugins } from '../../support/mount'

async function setup(signedInAs = 'admin') {
  const state = useScenario('admin-active', { signedInAs })
  state.domains = [
    mockDomain({
      name: 'edit.example',
      description: 'Old',
      maxMailboxes: 10,
      usage: {
        mailboxes: 8,
        resources: 0,
        aliases: 0,
        largestMailboxQuota: 0,
        quotaAllocated: 0,
        storageUsed: 0,
        messages: 0,
      },
      domainQuota: 50 * GIB,
    }),
  ]
  assignDomains(state, 'reseller', ['edit.example'])
  const domain = shallowRef<Domain>(await fetchDomain('edit.example'))
  testPlugins().queryClient.setQueryData(queryKeys.domains.detail('edit.example'), domain.value)
  let section!: ReturnType<typeof useDomainSectionSave>
  mountWithApp(
    defineComponent({
      setup() {
        section = useDomainSectionSave({
          domain: () => domain.value,
          fields: ['description', 'active', 'maxMailboxes'],
        })
        return () => h('div')
      },
    }),
  )
  section.open()
  return { state, section, domain }
}

describe('useDomainSectionSave', () => {
  it('200: saves the changed members with If-Match and continues with the new version', async () => {
    const { section } = await setup()
    const before = section.base.value!.etag
    const result = await section.save(() => ({ description: 'New' }))
    expect(result).toBe('saved')
    expect(section.base.value!.description).toBe('New')
    expect(section.base.value!.etag).not.toBe(before)
    const [request] = mockState().requests.filter((r) => r.operationId === 'updateDomain')
    expect(request!.headers['if-match']).toBe(before)
  })

  it('nothing changed: sends nothing', async () => {
    const { section } = await setup()
    expect(await section.save(() => ({}))).toBe('unchanged')
    expect(mockState().requests.some((r) => r.operationId === 'updateDomain')).toBe(false)
  })

  it('412: keeps the input, reloads and lists the changed fields; save again uses the latest version', async () => {
    const { state, section } = await setup()
    state.domains[0]!.description = 'Theirs'
    expect(await section.save(() => ({ description: 'Mine' }))).toBe('outdated')
    expect(section.outdatedFields.value).toEqual([{ field: 'description', savedValue: 'Theirs' }])
    expect(await section.saveAgain(() => ({ description: 'Mine' }))).toBe('saved')
    expect(section.base.value!.description).toBe('Mine')
    expect(section.outdatedFields.value).toBeNull()
  })

  it('412 then discard: takes the latest values', async () => {
    const { state, section } = await setup()
    state.domains[0]!.maxMailboxes = 20
    await section.save(() => ({ description: 'Mine' }))
    expect(section.outdatedFields.value).toEqual([{ field: 'maxMailboxes', savedValue: 20 }])
    expect(section.discard()?.maxMailboxes).toBe(20)
    expect(section.outdatedFields.value).toBeNull()
  })

  it('422: shows the field errors with their sizes', async () => {
    const { section } = await setup()
    expect(await section.save(() => ({ maxMailboxes: 5 }))).toBe('invalid')
    expect(section.form.errorsFor('maxMailboxes')[0]).toContain('8')
  })

  it('403 attribute-not-permitted: names the attributes, refreshes the identity and narrows the editable fields', async () => {
    const { state, section } = await setup('reseller')
    state.accounts.find((a) => a.username === 'reseller')!.permissions.domainDesc = false
    testPlugins().queryClient.setQueryData(queryKeys.identity(), { username: 'reseller' })
    expect(await section.save(() => ({ description: 'x' }))).toBe('refused')
    expect([...section.refused.value]).toEqual(['description'])
    expect(section.problem.value?.is('attribute-not-permitted')).toBe(true)
    expect(testPlugins().queryClient.getQueryState(queryKeys.identity())!.isInvalidated).toBe(true)
  })

  it('404: the domain is gone', async () => {
    const { state, section } = await setup()
    state.domains = []
    expect(await section.save(() => ({ description: 'x' }))).toBe('gone')
  })

  it('500 and network: nothing was saved, the problem is kept for a retry', async () => {
    const { state, section } = await setup()
    state.failures.updateDomain = { status: 500, times: 1 }
    expect(await section.save(() => ({ description: 'x' }))).toBe('failed')
    expect(section.problem.value?.status).toBe(500)
    await flushPromises()
    expect(await section.save(() => ({ description: 'x' }))).toBe('saved')
  })
})

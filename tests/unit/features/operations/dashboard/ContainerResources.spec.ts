// UI 011 (FR-010, T052): an expanded running container polls its resource usage and draws its Disk
// I/O and Net I/O charts; a stopped container, or one that stops (409), has no resource data.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ContainerResources from '@/features/operations/dashboard/components/ContainerResources.vue'

import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'
import { container } from './helpers'

const usageRequests = () =>
  mockState().requests.filter((r) => r.operationId === 'getContainerResourceUsage').length

describe('ContainerResources', () => {
  it('reads the usage of a running container and shows its two charts', async () => {
    useScenario('admin-operations')
    const wrapper = mountWithApp(ContainerResources, {
      props: { container: container({ name: 'dovecot-mailcow' }) },
    })
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    await vi.dynamicImportSettled()
    await flushPromises()
    expect(usageRequests()).toBe(1)
    expect(wrapper.findAll('figcaption').map((caption) => caption.text())).toEqual([
      'Disk I/O',
      'Net I/O',
    ])
    expect(wrapper.text()).toContain('Loading...')
  })

  it('reads nothing for a container that is not running', async () => {
    useScenario('admin-operations')
    const wrapper = mountWithApp(ContainerResources, {
      props: { container: container({ running: false, state: 'exited' }) },
    })
    await flushPromises()
    expect(usageRequests()).toBe(0)
    expect(wrapper.get('[data-no-resource-data]').text()).toBe(
      'No resource data is available while the container is not running.',
    )
  })

  it('stops after the API says the container is not running', async () => {
    useScenario('admin-operations')
    const wrapper = mountWithApp(ContainerResources, {
      props: { container: container({ name: 'sogo-mailcow' }) },
    })
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    await flushPromises()
    expect(wrapper.find('[data-no-resource-data]').exists()).toBe(true)
  })
})

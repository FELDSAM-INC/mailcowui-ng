// UI 011 (FR-026, FR-027, T051, T130): the installed version and the update status as legacy shows
// them; a disabled check shows only the version.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import VersionLine from '@/features/operations/dashboard/components/VersionLine.vue'

import { useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'

async function mountLine(scenario: string) {
  useScenario(scenario)
  const wrapper = mountWithApp(VersionLine)
  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('VersionLine', () => {
  it('offers the newest release when an update is available', async () => {
    const wrapper = await mountLine('admin-operations')
    expect(wrapper.text()).toContain('2026-09a')
    const status = wrapper.get('[data-update-status="updateAvailable"]')
    expect(status.text()).toContain('There is an update available')
    expect(status.get('button').text()).toBe('2026-10')
  })

  it('says the system is on the latest version', async () => {
    const wrapper = await mountLine('ops-update-up-to-date')
    expect(wrapper.get('[data-update-status]').text()).toBe('The System is on the latest version')
  })

  it('says the check failed without blocking anything', async () => {
    const wrapper = await mountLine('ops-update-check-failed')
    expect(wrapper.get('[data-update-status]').text()).toBe('Could not check for an Update')
  })

  it('shows only the version when the check is disabled', async () => {
    const wrapper = await mountLine('ops-update-disabled')
    expect(wrapper.find('[data-update-status]').exists()).toBe(false)
    expect(wrapper.text()).toBe('2026-09a')
  })
})

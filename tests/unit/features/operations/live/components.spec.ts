// UI 011 (FR-020, FR-021, FR-023, FR-025, T021): the live-update bar and a section's error state.
import { describe, expect, it } from 'vitest'

import LiveUpdatesBar from '@/features/operations/live/components/LiveUpdatesBar.vue'
import SectionError from '@/features/operations/live/components/SectionError.vue'

import { mountWithApp } from '../../../support/mount'

const since = Date.parse('2026-10-19T08:03:12Z')

function bar(props: Partial<InstanceType<typeof LiveUpdatesBar>['$props']> = {}) {
  return mountWithApp(LiveUpdatesBar, {
    props: { state: 'running', since, failed: false, refreshing: false, ...props },
  })
}

describe('LiveUpdatesBar', () => {
  it('offers pause and refresh while running, with no live region', async () => {
    const wrapper = bar()
    const buttons = wrapper.findAll('button').map((button) => button.text())
    expect(buttons).toEqual(['Pause live updates', 'Refresh'])
    expect(wrapper.find('[aria-live], [role="status"], [role="alert"]').exists()).toBe(false)
    await wrapper.findAll('button')[0]!.trigger('click')
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('pause')).toHaveLength(1)
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('says since when updates are paused and offers resume', async () => {
    const wrapper = bar({ state: 'paused' })
    expect(wrapper.get('[data-live-notice]').text()).toMatch(/^Live updates paused since .+\.$/)
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('resume')).toHaveLength(1)
  })

  it('explains the inactivity pause and offers resume', () => {
    const wrapper = bar({ state: 'inactive' })
    expect(wrapper.get('[data-live-notice]').text()).toBe(
      'Live updates were paused because there was no activity.',
    )
    expect(wrapper.findAll('button')[0]!.text()).toBe('Resume live updates')
  })

  it('offers a retry when the capabilities could not be read', async () => {
    const wrapper = bar({ state: 'unavailable' })
    expect(wrapper.get('[data-live-notice]').text()).toBe(
      'Live updates are off because the monitoring settings could not be read.',
    )
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('retryCapabilities')).toHaveLength(1)
  })

  it('says that updating failed while the last values stay', () => {
    const wrapper = bar({ failed: true })
    expect(wrapper.get('[data-live-failed]').text()).toBe(
      'Updating failed. The values shown may be out of date.',
    )
  })

  it('does not start a second refresh while one runs', async () => {
    const wrapper = bar({ refreshing: true })
    const refresh = wrapper.findAll('button')[1]!
    expect(refresh.attributes('aria-disabled')).toBe('true')
    await refresh.trigger('click')
    expect(wrapper.emitted('refresh')).toBeUndefined()
  })
})

describe('SectionError', () => {
  it('shows the section message and a retry', async () => {
    const wrapper = mountWithApp(SectionError)
    expect(wrapper.text()).toContain('This section could not be loaded.')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})

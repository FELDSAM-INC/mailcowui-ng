import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AnnouncementBanner from '@/app/shell/AnnouncementBanner.vue'
import { mountWithApp } from '../../support/mount'

describe('announcement draft preview', () => {
  it('renders a neutral announcement literally without a visit-persistent collapse action', async () => {
    const wrapper = mountWithApp(AnnouncementBanner, {
      props: { preview: true, announcement: { text: '<b>Notice</b>', type: null } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('<b>Notice</b>')
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('[data-announcement]').classes()).toContain('bg-gray-50')
    await wrapper.setProps({ announcement: { text: 'Changed', type: 'warning' } })
    expect(wrapper.text()).toContain('Important')
    expect(wrapper.text()).toContain('Changed')
    await wrapper.setProps({ announcement: null })
    expect(wrapper.find('[data-announcement]').exists()).toBe(false)
  })
})

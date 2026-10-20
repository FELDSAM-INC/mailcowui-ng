import { beforeEach, describe, expect, it } from 'vitest'
import ContrastReport from '@/features/system-settings/components/branding/ContrastReport.vue'
import { loadFeatureMessages } from '@/i18n'
import { mountWithApp } from '../../../../support/mount'

beforeEach(() => loadFeatureMessages('system-settings'))
describe('ContrastReport', () => {
  it('shows a textual verdict with the ratio, minimum and reference surface', async () => {
    const wrapper = mountWithApp(ContrastReport, {
      props: { colour: '#1d4ed8', surface: '#ffffff', minimum: 4.5 },
    })
    expect(wrapper.text()).toContain('6.7:1')
    expect(wrapper.text()).toContain('4.5:1')
    expect(wrapper.text()).toContain('#ffffff')
    expect(wrapper.text()).toContain('Passes')
    await wrapper.setProps({ colour: '#ffd700' })
    expect(wrapper.text()).toContain('1.4:1')
    expect(wrapper.text()).toContain('Fails')
  })
})

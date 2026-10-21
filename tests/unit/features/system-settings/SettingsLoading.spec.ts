import { describe, expect, it } from 'vitest'
import SettingsLoading from '@/features/system-settings/components/common/SettingsLoading.vue'
import { mountWithApp } from '../../support/mount'

describe('settings loading state', () => {
  it('announces loading once without exposing fake fields or keyboard stops', () => {
    const wrapper = mountWithApp(SettingsLoading)
    const status = wrapper.get('[role=status]')
    expect(status.attributes('aria-busy')).toBe('true')
    expect(status.text()).toBe('Please wait...')
    expect(wrapper.findAll('[role=status]')).toHaveLength(1)
    expect(wrapper.find('input, textarea, select, button, a, [tabindex]').exists()).toBe(false)
    expect(wrapper.get('[data-loading-shape]').attributes('aria-hidden')).toBe('true')
    // No animation is needed to communicate progress, including under reduced motion.
    expect(wrapper.html()).not.toMatch(/animate-|transition-/)
  })
})

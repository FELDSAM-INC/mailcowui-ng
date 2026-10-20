import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { loadFeatureMessages } from '@/i18n'
import PlaceholderReference from '@/features/system-settings/components/passwords/PlaceholderReference.vue'
import { mountWithApp } from '../../support/mount'

describe('reset placeholder reference', () => {
  it('pairs all six legacy meanings with a copy action for the exact placeholder', async () => {
    await loadFeatureMessages('system-settings')
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = mountWithApp(PlaceholderReference)
    const values = [
      '{{link}}',
      '{{username}}',
      '{{username2}}',
      '{{date}}',
      '{{token_lifetime}}',
      '{{hostname}}',
    ]
    const rows = wrapper.findAll('li')
    expect(rows).toHaveLength(values.length)
    for (let i = 0; i < rows.length; i += 1) {
      expect(rows[i]!.get('code').text()).toBe(values[i])
      expect(rows[i]!.get('.legacy-html').text().length).toBeGreaterThan(5)
      await rows[i]!.get('button').trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenLastCalledWith(values[i])
    }
  })
})

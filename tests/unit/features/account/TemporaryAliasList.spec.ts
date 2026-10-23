import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TemporaryAliasList from '@/features/account/components/temporary-aliases/TemporaryAliasList.vue'
import * as clipboard from '@/shared/platform/clipboard'
import { mockTemporaryAlias, temporaryAliasView } from '../../../mocks/factories/temporary-alias'
import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

const item = temporaryAliasView(
  'anna@example.org',
  mockTemporaryAlias({ address: 'shop.alias@example.org' }),
)
const limits = { minLifetimeHours: 1, maxLifetimeHours: 87600, defaultLifetimeHours: 8760 } as const
function render(wide: boolean) {
  installMatchMedia({ '(min-width: 768px)': wide })
  return mountWithApp(TemporaryAliasList, {
    props: { items: [item], selection: false, selected: [], canChange: true, busy: false, limits },
    global: { plugins: [createTestRouter()] },
    attachTo: document.body,
  })
}

describe('TemporaryAliasList actions', () => {
  it.each([true, false])(
    'offers validity changes and removal in one menu without History (wide=%s)',
    async (wide) => {
      const wrapper = render(wide)
      expect(wrapper.find('select').exists()).toBe(false)
      const trigger = wrapper.get('[data-row-action-trigger]')
      await trigger.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      let actions = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      expect(actions).toHaveLength(9)
      expect(actions.some((action) => action.textContent?.includes('History'))).toBe(false)
      actions.find((action) => action.textContent?.trim() === 'Never Expire')!.click()
      await vi.waitFor(() => expect(wrapper.emitted('validity')?.[0]).toEqual([item, 'permanent']))
      await trigger.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      actions = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      actions
        .find((action) => action.getAttribute('aria-label') === `Remove: ${item.address}`)!
        .click()
      await vi.waitFor(() => expect(wrapper.emitted('remove')?.[0]).toEqual([item]))
      wrapper.unmount()
    },
  )

  it.each([true, false])(
    'keeps Copy as the sole direct action and selects the address on refusal (wide=%s)',
    async (wide) => {
      const copy = vi.spyOn(clipboard, 'copyText').mockResolvedValue('refused')
      const wrapper = render(wide)
      await wrapper.setProps({ canChange: false })
      expect(wrapper.find('[data-row-action-trigger]').exists()).toBe(false)
      await wrapper.get(`button[aria-label="Copy: ${item.address}"]`).trigger('click')
      await flushPromises()
      expect(copy).toHaveBeenCalledWith(item.address)
      expect(document.activeElement).toBe(wrapper.get('[data-alias-address]').element)
      expect(window.getSelection()?.toString()).toBe(item.address)
      expect(wrapper.get('[role="alert"]').text()).toContain('copy')
      wrapper.unmount()
    },
  )

  it('keeps the mobile action menu beside the address', () => {
    const wrapper = render(false)
    expect(wrapper.find('[data-card-header] [data-row-action-trigger]').exists()).toBe(true)
    expect(wrapper.find('select').exists()).toBe(false)
    wrapper.unmount()
  })
})

// UI 011 (plan decisions 6, 11 and 16): legacy's quick actions of a log table ("+ 100", "+ 1000",
// Expand All, Collapse All) and the objects of legacy's #ConfirmDeleteModal for "Remove hash".
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LogQuickActions from '@/features/operations/logs/components/LogQuickActions.vue'
import ResetHashContent from '@/features/operations/logs/components/ResetHashContent.vue'

import { mountWithApp } from '../../../support/mount'

const items = () =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((item) =>
    item.textContent?.trim(),
  )

async function open(props: { details: boolean; more?: boolean; busy?: boolean }) {
  const wrapper = mountWithApp(LogQuickActions, { props, attachTo: document.body })
  const trigger = wrapper.get('button')
  expect(trigger.text()).toBe('Actions')
  await trigger.trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return wrapper
}

describe('LogQuickActions', () => {
  it('offers "+ 100", "+ 1000", Expand All and Collapse All, and emits the choice', async () => {
    const wrapper = await open({ details: true })
    expect(items()).toEqual(['+ 100', '+ 1000', 'Expand All', 'Collapse All'])
    const menuItems = document.querySelectorAll<HTMLElement>('[role="menuitem"]')
    menuItems[1]!.click()
    await flushPromises()
    expect(wrapper.emitted('more')).toEqual([[1000]])
    wrapper.unmount()
  })

  it('emits Expand All and Collapse All', async () => {
    const first = await open({ details: true })
    document.querySelectorAll<HTMLElement>('[role="menuitem"]')[2]!.click()
    await flushPromises()
    expect(first.emitted('expandAll')).toHaveLength(1)
    first.unmount()
    const second = await open({ details: true })
    document.querySelectorAll<HTMLElement>('[role="menuitem"]')[3]!.click()
    await flushPromises()
    expect(second.emitted('collapseAll')).toHaveLength(1)
    second.unmount()
  })

  it('offers only loading more for a log without details, and only the details for Rspamd', async () => {
    const plain = await open({ details: false })
    expect(items()).toEqual(['+ 100', '+ 1000'])
    plain.unmount()
    const rspamd = await open({ details: true, more: false })
    expect(items()).toEqual(['Expand All', 'Collapse All'])
    rspamd.unmount()
  })

  it('disables loading more while entries are loading', async () => {
    const wrapper = await open({ details: false, busy: true })
    const menuItems = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(menuItems.every((item) => item.hasAttribute('data-disabled'))).toBe(true)
    wrapper.unmount()
  })
})

describe('ResetHashContent', () => {
  it('lists the hash as text, as legacy lists the objects to delete', () => {
    const wrapper = mountWithApp(ResetHashContent, {
      props: { items: ['RLbucket0hash', '<b>RL</b>'] },
    })
    expect(wrapper.findAll('li').map((item) => item.text())).toEqual(['RLbucket0hash', '<b>RL</b>'])
    expect(wrapper.find('b').exists()).toBe(false)
  })
})

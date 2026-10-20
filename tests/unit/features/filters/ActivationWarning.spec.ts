import { expect, it } from 'vitest'
import ActivationWarning from '@/features/filters/components/ActivationWarning.vue'
import { mountWithApp } from '../../support/mount'

it('uses the general legacy activation warning only when active is selected', async () => {
  const wrapper = mountWithApp(ActivationWarning, { props: { active: true } })
  expect(wrapper.text()).toBe('All other filters will be deactivated, when active is checked.')
  await wrapper.setProps({ active: false })
  expect(wrapper.text()).toBe('')
})

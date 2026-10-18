// T047: the single sign-on action (FR-040, FR-043): the classic button text `admin.iam_sso`, full
// width, and a busy state that prevents a second start.
import { describe, expect, it } from 'vitest'

import SingleSignOnButton from '@/features/auth/components/SingleSignOnButton.vue'
import { lt } from '@/i18n'

import { mountWithApp } from '../../support/mount'

describe('SingleSignOnButton', () => {
  it('starts with the classic label', async () => {
    const wrapper = mountWithApp(SingleSignOnButton, { props: { pending: false } })
    const button = wrapper.get('button')
    expect(button.text()).toBe(lt('admin.iam_sso'))
    expect(button.classes()).toContain('w-full')
    await button.trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('is busy and refuses a second start while pending', async () => {
    const wrapper = mountWithApp(SingleSignOnButton, { props: { pending: true } })
    const button = wrapper.get('button')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('start')).toBeUndefined()
  })
})

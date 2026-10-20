// Section editing (UI 002 T015, research D11): an Edit action only when editable, read-only values
// as text, the parent driving `edit` and `close`, a full-width section with a sticky action bar and
// a focused heading below md, in place from md up, other sections' Edit disabled with a reason,
// inline status messages and the outdated notice.
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { h } from 'vue'

import EditableSection from '@/shared/components/EditableSection.vue'

import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'

const MD = '(min-width: 768px)'

function mountSection(props: Record<string, unknown> = {}, wide = true) {
  installMatchMedia({ [MD]: wide })
  return mountWithApp(EditableSection, {
    attachTo: document.body,
    props: {
      sectionId: 'limits',
      title: 'Limits and quotas',
      editable: true,
      editing: false,
      ...props,
    },
    slots: {
      default: () => h('dl', [h('dt', 'Max. mailboxes'), h('dd', '10')]),
      form: () => h('input', { id: 'field', 'aria-label': 'Max. mailboxes' }),
    },
  })
}

describe('EditableSection', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('offers Edit only when editable, and shows read-only values as text', async () => {
    const wrapper = mountSection()
    const edit = wrapper.get('button')
    expect(edit.text()).toContain('Edit')
    expect(edit.attributes('aria-label')).toBe('Edit Limits and quotas')
    await edit.trigger('click')
    expect(wrapper.emitted('edit')).toHaveLength(1)
    const readOnly = mountSection({ editable: false })
    expect(readOnly.findAll('button')).toHaveLength(0)
    expect(readOnly.find('input').exists()).toBe(false)
    expect(readOnly.text()).toContain('10')
  })

  it('renders the form while editing and emits save and cancel', async () => {
    const wrapper = mountSection({ editing: true })
    expect(wrapper.find('#field').exists()).toBe(true)
    expect(wrapper.find('dl').exists()).toBe(false)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Save')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Cancel')!
      .trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('below md opens full width with a sticky action bar and focuses its heading', async () => {
    const wrapper = mountSection({ editing: false }, false)
    await wrapper.setProps({ editing: true })
    await flushPromises()
    const heading = wrapper.get('h2')
    expect(document.activeElement).toBe(heading.element)
    const bar = wrapper.get('[data-section-actions]')
    expect(bar.classes()).toContain('sticky')
    expect(bar.text()).toContain('Save')
    expect(bar.text()).toContain('Cancel')
    expect(wrapper.get('section').attributes('data-layout')).toBe('full')
  })

  it('from md up opens in place', async () => {
    const wrapper = mountSection({ editing: false }, true)
    await wrapper.setProps({ editing: true })
    await flushPromises()
    expect(wrapper.get('section').attributes('data-layout')).toBe('inline')
    expect(wrapper.get('[data-section-actions]').classes()).not.toContain('sticky')
    expect(document.activeElement).toBe(wrapper.get('h2').element)
  })

  it('disables Edit with a reason while another section is open', async () => {
    const wrapper = mountSection({ editDisabledReason: 'Finish editing General first.' })
    const edit = wrapper.get('button')
    expect(edit.attributes('aria-disabled')).toBe('true')
    const reason = document.getElementById(edit.attributes('aria-describedby')!)
    expect(reason?.textContent).toContain('Finish editing General first.')
    await edit.trigger('click')
    expect(wrapper.emitted('edit')).toBeUndefined()
  })

  it('shows an inline status message that stays until the next action', async () => {
    const wrapper = mountSection({ status: { kind: 'success', message: 'Saved.' } })
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toContain('Saved.')
    await flushPromises()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('requires an explicit retry when the version changed without field differences', async () => {
    const wrapper = mountSection({ editing: true, versionChanged: true, outdated: [] })
    expect(wrapper.find('[data-outdated]').exists()).toBe(true)
    expect(wrapper.find('[data-outdated] li').exists()).toBe(false)
    expect(wrapper.get('[data-outdated]').text()).not.toContain('These values changed:')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Save again')!
      .trigger('click')
    expect(wrapper.emitted('saveAgain')).toHaveLength(1)
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('lists the changed fields with their saved values and offers Save again and Discard', async () => {
    const wrapper = mountSection({
      editing: true,
      outdated: [
        { field: 'maxMailboxes', label: 'Max. mailboxes', saved: '12' },
        { field: 'domainQuota', label: 'Domain quota', saved: '20 GiB' },
      ],
    })
    const notice = wrapper.get('[data-outdated]')
    expect(notice.attributes('role')).toBe('alert')
    expect(notice.text()).toContain('Max. mailboxes: now saved as 12')
    expect(notice.text()).toContain('Domain quota: now saved as 20 GiB')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Save again')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Discard my changes')!
      .trigger('click')
    expect(wrapper.emitted('saveAgain')).toHaveLength(1)
    expect(wrapper.emitted('discard')).toHaveLength(1)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Save')).toBe(false)
  })
})

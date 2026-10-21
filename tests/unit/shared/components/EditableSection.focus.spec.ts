import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import EditableSection from '@/shared/components/EditableSection.vue'
import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'

const mounted: { unmount(): void }[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})
function section() {
  installMatchMedia({ '(min-width: 768px)': false })
  const wrapper = mountWithApp(EditableSection, {
    attachTo: document.body,
    props: { sectionId: 'links', title: 'Links', editable: true, editing: true },
    slots: { form: () => h('input', { 'aria-label': 'Name' }) },
  })
  mounted.push(wrapper)
  return wrapper
}

describe('EditableSection focus after an asynchronous save', () => {
  it('returns to the section heading after the pending Save button loses native focus', async () => {
    const wrapper = section()
    const save = wrapper.get<HTMLButtonElement>('button[type=submit]')
    save.element.focus()
    await wrapper.get('form').trigger('submit')
    await wrapper.setProps({ saving: true })
    expect(save.element.disabled).toBe(true)
    // Chromium blurs a focused button when it becomes disabled; jsdom needs that step explicit.
    document.body.tabIndex = -1
    document.body.focus()
    document.body.removeAttribute('tabindex')
    expect(document.activeElement).toBe(document.body)
    // The request's finally releases pending before its caller processes the result and closes.
    await wrapper.setProps({ saving: false })
    await flushPromises()
    await wrapper.setProps({ editing: false })
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('h2').element)
  })

  it('does not take focus back after the user moves outside while the save is pending', async () => {
    const wrapper = section()
    const outside = document.createElement('button')
    outside.textContent = 'Other section'
    document.body.append(outside)
    wrapper.get<HTMLButtonElement>('button[type=submit]').element.focus()
    await wrapper.get('form').trigger('submit')
    await wrapper.setProps({ saving: true })
    outside.focus()
    await wrapper.setProps({ saving: false, editing: false })
    await flushPromises()
    expect(document.activeElement).toBe(outside)
  })

  it('does not restore stale focus after an intentional outside move subsequently blurs', async () => {
    const wrapper = section()
    const outside = document.createElement('button')
    document.body.append(outside)
    wrapper.get<HTMLButtonElement>('button[type=submit]').element.focus()
    await wrapper.get('form').trigger('submit')
    await wrapper.setProps({ saving: true })
    outside.focus()
    outside.blur()
    await wrapper.setProps({ saving: false, editing: false })
    await flushPromises()
    expect(document.activeElement).toBe(document.body)
  })
})

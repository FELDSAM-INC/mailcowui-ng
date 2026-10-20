import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mountWithApp } from '../../support/mount'
import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => vi.restoreAllMocks())
it('keeps text inert and Tab native, wraps initially, and reports byte limits and marks', async () => {
  const wrapper = mountWithApp(CodeEditor, {
    props: {
      id: 'editor',
      label: 'Map',
      modelValue: '😀😀',
      maxBytes: 6,
      marks: [{ line: 1, message: 'Broken pattern' }],
    },
  })
  const textarea = wrapper.get('textarea')
  expect(textarea.attributes('wrap')).toBe('soft')
  expect(textarea.attributes('aria-invalid')).toBe('true')
  expect(textarea.attributes('autocomplete')).toBe('off')
  expect(wrapper.text()).toContain('exceeds')
  expect(wrapper.text()).toContain('Broken pattern')
  await wrapper.get('input[type=checkbox]').setValue(false)
  expect(textarea.attributes('wrap')).toBe('off')
  const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
  textarea.element.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
  await textarea.setValue('<script>alert(1)</script>')
  expect(wrapper.find('script').exists()).toBe(false)
  expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['<script>alert(1)</script>'])
})
it('does not allow read-only maps to be typed into', () => {
  const wrapper = mountWithApp(CodeEditor, {
    props: { id: 'read', label: 'Map', modelValue: '/x/', maxBytes: 100, readonly: true },
  })
  expect(wrapper.get('textarea').attributes()).toHaveProperty('readonly')
})

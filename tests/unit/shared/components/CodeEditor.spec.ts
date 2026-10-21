import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { h } from 'vue'
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
it('allows semantic mark content without changing its plain accessible description', () => {
  const wrapper = mountWithApp(CodeEditor, {
    props: {
      id: 'quoted',
      label: 'Script',
      modelValue: 'keep',
      maxBytes: 100,
      marks: [{ line: 1, message: 'Parser: untrusted detail' }],
    },
    slots: {
      'mark-message': ({ mark, index }) =>
        h('q', { lang: 'en', 'data-index': index }, mark.message),
    },
  })
  expect(wrapper.get('q[lang=en]').text()).toBe('Parser: untrusted detail')
  expect(wrapper.get('q').attributes('data-index')).toBe('0')
  expect(wrapper.text()).toContain('Go to line 1')
  expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
})
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
it('does not build a hidden document mirror when line numbers are disabled', () => {
  let run: FrameRequestCallback = () => {}
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    run = callback
    return 1
  })
  const wrapper = mountWithApp(CodeEditor, {
    props: {
      id: 'plain',
      label: 'Template',
      modelValue: 'text\n'.repeat(200_000),
      maxBytes: 1_048_576,
      lineNumbers: false,
    },
  })
  run(0)
  expect(wrapper.get('.invisible').element.childNodes).toHaveLength(0)
  expect(wrapper.find('[data-line-gutter]').exists()).toBe(false)
})

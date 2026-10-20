import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'
import { mountWithApp } from '../../support/mount'
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
afterEach(() => vi.unstubAllGlobals())
const LargeCodeEditor = { props: ['modelValue'], template: '<div data-large-stub />' }
it('keeps small documents native and lazily selects the large editor for an initial large document', async () => {
  const small = mountWithApp(CodeEditor, {
    props: {
      id: 'small',
      label: 'Small',
      modelValue: 'hello',
      virtualizeLarge: true,
      maxBytes: 1_048_576,
    },
    global: { stubs: { LargeCodeEditor } },
  })
  expect(small.find('textarea').exists()).toBe(true)
  const large = mountWithApp(CodeEditor, {
    props: {
      id: 'large',
      label: 'Large',
      modelValue: 'x'.repeat(140_000),
      virtualizeLarge: true,
      maxBytes: 1_048_576,
    },
    global: { stubs: { LargeCodeEditor } },
  })
  await flushPromises()
  expect(large.find('[data-large-stub]').exists()).toBe(true)
  expect(large.find('textarea').exists()).toBe(false)
})
it('does not replace the editing surface during typing or composition when the threshold is crossed', async () => {
  const editor = mountWithApp(CodeEditor, {
    props: {
      id: 'editor',
      label: 'Map',
      modelValue: 'small',
      virtualizeLarge: true,
      maxBytes: 1_048_576,
    },
    global: { stubs: { LargeCodeEditor } },
  })
  const original = editor.get('textarea').element
  await editor.setProps({ modelValue: 'x'.repeat(140_000) })
  expect(editor.get('textarea').element).toBe(original)
  expect(editor.find('[data-large-stub]').exists()).toBe(false)
})

it('preserves native selection for large documents unless the caller opts in', () => {
  const editor = mountWithApp(CodeEditor, {
    props: { id: 'copyable', label: 'Map', modelValue: 'x'.repeat(140_000), maxBytes: 1_048_576 },
    global: { stubs: { LargeCodeEditor } },
  })
  expect(editor.find('textarea').exists()).toBe(true)
  expect(editor.find('[data-large-stub]').exists()).toBe(false)
})

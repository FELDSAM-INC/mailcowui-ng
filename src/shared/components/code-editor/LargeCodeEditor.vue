<script setup lang="ts">
// Loaded only for an initially large document. The open shadow root lets style-mod use
// constructed stylesheets, preserving the application's strict style-src without a nonce.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Compartment, EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap, lineNumbers as numberGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

const props = defineProps<{
  id: string
  modelValue: string
  label: string
  description: string
  wrap: boolean
  lineNumbers: boolean
  readonly: boolean
  disabled: boolean
  required: boolean
  invalid: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const host = ref<HTMLDivElement>()
const ready = ref(false)
let view: EditorView | undefined
let descriptionNode: HTMLParagraphElement | undefined
let current = props.modelValue
const controls = new Compartment()
const wrapping = new Compartment()
const gutter = new Compartment()
const controlsFor = () => [
  EditorState.readOnly.of(props.readonly || props.disabled),
  EditorView.editable.of(!props.readonly && !props.disabled),
  EditorView.contentAttributes.of({
    id: props.id,
    'aria-label': props.label,
    'aria-describedby': `${props.id}-description`,
    'aria-invalid': String(props.invalid),
    'aria-required': String(props.required),
    'aria-disabled': String(props.disabled),
    tabindex: props.disabled ? '-1' : '0',
    spellcheck: 'false',
    autocorrect: 'off',
    autocapitalize: 'off',
    autocomplete: 'off',
  }),
]
onMounted(() => {
  const element = host.value!
  const root = element.attachShadow({ mode: 'open' })
  element.inert = true
  descriptionNode = document.createElement('p')
  descriptionNode.id = `${props.id}-description`
  descriptionNode.className = 'editor-description'
  descriptionNode.textContent = props.description
  root.append(descriptionNode)
  view = new EditorView({
    root,
    parent: root,
    state: EditorState.create({
      doc: current,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        controls.of(controlsFor()),
        wrapping.of(props.wrap ? EditorView.lineWrapping : []),
        gutter.of(props.lineNumbers ? numberGutter() : []),
        EditorView.theme({
          '&': {
            height: '360px',
            color: 'inherit',
            backgroundColor: 'transparent',
            fontSize: '14px',
          },
          '&.cm-focused': { outline: '2px solid var(--color-brand-500)', outlineOffset: '-2px' },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'var(--font-mono, monospace)',
            lineHeight: '24px',
          },
          '.cm-content': { padding: '12px 0', caretColor: 'currentColor' },
          '.cm-line': { padding: '0 12px' },
          '.cm-gutters': { color: 'inherit', backgroundColor: 'transparent', border: 'none' },
          '.cm-lineNumbers .cm-gutterElement': { minWidth: '48px', padding: '0 8px' },
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          current = update.state.doc.toString()
          emit('update:modelValue', current)
        }),
      ],
    }),
  })
  // A local accessible description can be referenced across browsers inside the shadow root.
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(
    '.editor-description{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}',
  )
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
  view.requestMeasure({
    read: () => view?.contentHeight,
    write: () =>
      queueMicrotask(() => {
        if (!view) return
        element.inert = false
        ready.value = true
      }),
  })
})
watch(
  () => props.modelValue,
  (value) => {
    if (!view || value === current) return
    current = value
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: Transaction.addToHistory.of(false),
    })
  },
)
watch(
  () => [props.label, props.readonly, props.disabled, props.required, props.invalid],
  () => {
    view?.dispatch({ effects: controls.reconfigure(controlsFor()) })
  },
)
watch(
  () => props.description,
  (value) => {
    if (descriptionNode) descriptionNode.textContent = value
  },
)
watch(
  () => props.wrap,
  (value) =>
    view?.dispatch({ effects: wrapping.reconfigure(value ? EditorView.lineWrapping : []) }),
)
watch(
  () => props.lineNumbers,
  (value) => view?.dispatch({ effects: gutter.reconfigure(value ? numberGutter() : []) }),
)
function goToLine(number: number) {
  if (!view) return
  const line = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, number)))
  view.dispatch({
    selection: { anchor: line.from, head: line.to },
    effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
  })
  view.focus()
}
defineExpose({ goToLine })
onBeforeUnmount(() => {
  view?.destroy()
  view = undefined
})
</script>
<template>
  <div
    ref="host"
    data-large-code-editor
    :data-editor-ready="ready"
    :aria-busy="!ready || undefined"
    class="min-w-0 overflow-hidden rounded-lg border border-gray-300 text-gray-900 dark:border-gray-600 dark:text-white"
  />
</template>

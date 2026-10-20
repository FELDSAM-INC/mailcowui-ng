<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormat } from '@/i18n/format'
import { announce } from '@/shared/composables/useAnnouncer'
import { utf8ByteLength } from '@/shared/validation/utf8'
import { buttonVariants } from '@/shared/ui/button'
import { measureLines, updateLineLayout, visibleLines } from './line-layout'
import EditorLoadState from './EditorLoadState.vue'
const loadFailure = ref<Error>()
const nativeFallback = ref(false)
const LargeCodeEditor = defineAsyncComponent({
  loader: () =>
    import('./LargeCodeEditor.vue').catch((error: Error) => {
      loadFailure.value = error
      throw error
    }),
  loadingComponent: EditorLoadState,
  errorComponent: EditorLoadState,
  delay: 0,
})

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string
    label: string
    maxBytes: number
    marks?: readonly { line: number; message: string }[]
    errors?: readonly string[]
    readonly?: boolean
    disabled?: boolean
    lineNumbers?: boolean
    required?: boolean
    virtualizeLarge?: boolean
  }>(),
  {
    marks: () => [],
    errors: () => [],
    readonly: false,
    disabled: false,
    lineNumbers: true,
    required: false,
    virtualizeLarge: false,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()
const format = useFormat()
const input = ref<HTMLTextAreaElement>()
const mirror = ref<HTMLDivElement>()
const wrap = ref(true)
const numbers = ref<{ line: number; top: number }[]>([])
const used = computed(() => utf8ByteLength(props.modelValue))
// Choose once per mounted document: switching surfaces mid-edit would lose native undo/IME state.
const initiallyLarge = props.virtualizeLarge && used.value >= 128 * 1024
const virtual = computed(() => initiallyLarge && !nativeFallback.value)
const largeEditor = ref<InstanceType<typeof LargeCodeEditor>>()
const description = computed(() =>
  [
    t('codeEditor.tabHint'),
    ...props.errors,
    ...props.marks.map(
      (mark) => t('codeEditor.line', { line: format.number(mark.line) }) + ': ' + mark.message,
    ),
  ].join(' '),
)
const invalid = computed(
  () => used.value > props.maxBytes || props.marks.length > 0 || props.errors.length > 0,
)
let layout = measureLines('', () => 24)
let frame = 0
let observer: ResizeObserver | undefined
let textNode: Text | undefined
let mirrored = ''
let geometry = ''
let paddingTop = 0
let paddingY = 0
let contentWidth = 0
let lineHeight = 24
let characterWidth = 0
function top(index: number): number {
  return paddingTop + (layout.tops[index] ?? 0)
}
function measure(force = false) {
  frame = 0
  const element = input.value
  const copy = mirror.value
  if (!element || !copy) return
  if (!props.lineNumbers && !force) {
    numbers.value = []
    return
  }
  const style = getComputedStyle(element)
  const width = `${element.clientWidth}px`
  const nextGeometry = [width, wrap.value, style.font, style.lineHeight, style.letterSpacing].join(
    '|',
  )
  const resized = geometry !== nextGeometry || !textNode
  if (resized) {
    geometry = nextGeometry
    paddingTop = Number.parseFloat(style.paddingTop) || 0
    paddingY = paddingTop + (Number.parseFloat(style.paddingBottom) || 0)
    contentWidth =
      element.clientWidth -
      (Number.parseFloat(style.paddingLeft) || 0) -
      (Number.parseFloat(style.paddingRight) || 0)
    lineHeight = Number.parseFloat(style.lineHeight) || 24
    copy.style.width = width
    copy.style.whiteSpace = wrap.value ? 'pre-wrap' : 'pre'
    textNode ??= document.createTextNode('')
    if (textNode.parentNode !== copy) copy.replaceChildren(textNode)
    // Native font metrics keep the no-wrap fast path exact for ASCII in this monospace editor.
    textNode.data = 'M'
    const range = document.createRange()
    range.selectNodeContents(textNode)
    characterWidth = range.getBoundingClientRect().width
    layout.heights.clear()
  }
  // textarea.value has the browser's LF normalization, which selection offsets also use.
  const value = props.modelValue.replace(/\r\n?/g, '\n')
  if (resized || mirrored !== value) {
    mirrored = value
    const measureLine = (line: string) => {
      if (
        !wrap.value ||
        !line ||
        (characterWidth > 0 &&
          line.length * characterWidth < contentWidth - 1 &&
          /^[\u0020-\u007e]*$/.test(line))
      )
        return lineHeight
      // Only one logical line enters the mirror, and only when its text/geometry is new.
      textNode!.data = line
      return Math.max(lineHeight, copy.getBoundingClientRect().height - paddingY)
    }
    layout = resized
      ? measureLines(value, measureLine)
      : updateLineLayout(layout, value, measureLine)
  }
  numbers.value = props.lineNumbers
    ? visibleLines(layout.offsets.length, top, element.scrollTop, element.clientHeight)
    : []
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(() => measure())
}
async function goToLine(line: number) {
  await nextTick()
  if (virtual.value) {
    largeEditor.value?.goToLine(line)
    announce(t('codeEditor.line', { line: format.number(line) }))
    return
  }
  if (frame) cancelAnimationFrame(frame)
  measure(true)
  const element = input.value
  if (!element) return
  const index = Math.max(0, Math.min(layout.offsets.length - 1, line - 1))
  element.focus()
  element.setSelectionRange(
    layout.offsets[index]!,
    (layout.offsets[index + 1] ?? element.value.length + 1) - 1,
  )
  element.scrollTop = Math.max(0, top(index) - element.clientHeight / 3)
  schedule()
  announce(t('codeEditor.line', { line: format.number(index + 1) }))
}
defineExpose({ goToLine })
watch(() => [props.modelValue, wrap.value, props.lineNumbers], schedule)
watch(input, (element) => {
  observer?.disconnect()
  if (element) observer?.observe(element)
  schedule()
})
onMounted(() => {
  observer = new ResizeObserver(schedule)
  if (input.value) observer.observe(input.value)
  schedule()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  if (frame) cancelAnimationFrame(frame)
})
</script>

<template>
  <div data-code-editor class="min-w-0 space-y-2">
    <component
      :is="virtual ? 'p' : 'label'"
      :for="virtual ? undefined : id"
      class="block text-sm font-medium text-gray-800 dark:text-gray-200"
      >{{ label }}</component
    >
    <EditorLoadState
      v-if="virtual && loadFailure"
      :error="loadFailure"
      @fallback="nativeFallback = true"
    />
    <LargeCodeEditor
      v-else-if="virtual"
      :id="id"
      ref="largeEditor"
      :model-value="modelValue"
      :label="label"
      :description="description"
      :wrap="wrap"
      :line-numbers="lineNumbers"
      :readonly="readonly"
      :disabled="disabled"
      :required="required"
      :invalid="invalid"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <div
      v-else
      class="relative flex min-w-0 overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600"
    >
      <div
        v-if="lineNumbers"
        aria-hidden="true"
        data-line-gutter
        class="relative w-12 shrink-0 overflow-hidden bg-gray-50 font-mono text-sm leading-6 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      >
        <span
          v-for="number in numbers"
          :key="number.line"
          class="absolute inset-x-0 pe-2 text-end"
          :style="{ top: `${number.top}px` }"
          >{{ number.line }}</span
        >
      </div>
      <textarea
        :id="id"
        ref="input"
        :value="modelValue"
        :readonly="readonly"
        :required="required"
        :disabled="disabled"
        :wrap="wrap ? 'soft' : 'off'"
        :aria-invalid="invalid || undefined"
        :aria-describedby="`${id}-hint ${id}-messages`"
        rows="14"
        autocapitalize="off"
        autocorrect="off"
        autocomplete="off"
        :spellcheck="false"
        class="min-w-0 flex-1 resize-y overflow-auto bg-transparent p-3 font-mono text-sm leading-6 text-gray-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:text-white"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @scroll="schedule"
      />
      <div
        ref="mirror"
        aria-hidden="true"
        class="pointer-events-none invisible absolute start-0 top-0 overflow-hidden p-3 font-mono text-sm leading-6 [overflow-wrap:break-word]"
      />
    </div>
    <label class="flex min-h-11 items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
      ><input v-model="wrap" type="checkbox" class="size-5 accent-brand-600" />{{
        t('codeEditor.wrap')
      }}</label
    >
    <p :id="`${id}-hint`" class="text-sm text-gray-600 dark:text-gray-400">
      {{ t('codeEditor.tabHint') }}
    </p>
    <div :id="`${id}-messages`" class="space-y-2 text-sm">
      <p
        v-if="used >= maxBytes * 0.9"
        role="status"
        :class="
          used > maxBytes ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400'
        "
      >
        {{
          t(used > maxBytes ? 'codeEditor.overLimit' : 'codeEditor.size', {
            used: format.bytes(used),
            max: format.bytes(maxBytes),
          })
        }}
      </p>
      <p v-for="error in errors" :key="error" role="alert" class="text-red-700 dark:text-red-300">
        {{ error }}
      </p>
      <ul v-if="marks.length" class="space-y-2">
        <li
          v-for="mark in marks.slice(0, 100)"
          :key="`${mark.line}-${mark.message}`"
          class="flex flex-wrap items-center gap-2 text-red-700 dark:text-red-300"
        >
          <span
            >{{ t('codeEditor.line', { line: format.number(mark.line) }) }}:
            {{ mark.message }}</span
          ><button
            type="button"
            :class="buttonVariants({ variant: 'outline', size: 'sm' })"
            @click="goToLine(mark.line)"
          >
            {{ t('codeEditor.goToLine', { line: format.number(mark.line) }) }}
          </button>
        </li>
      </ul>
      <p v-if="marks.length > 100" class="text-gray-600 dark:text-gray-400">
        {{ t('codeEditor.moreErrors', { count: format.number(marks.length - 100) }) }}
      </p>
    </div>
  </div>
</template>

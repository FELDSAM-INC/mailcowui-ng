<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormat } from '@/i18n/format'
import { announce } from '@/shared/composables/useAnnouncer'
import { utf8ByteLength } from '@/shared/validation/utf8'
import { buttonVariants } from '@/shared/ui/button'
import { lineOffsets, visibleLines } from './line-layout'

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
  }>(),
  {
    marks: () => [],
    errors: () => [],
    readonly: false,
    disabled: false,
    lineNumbers: true,
    required: false,
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
const invalid = computed(
  () => used.value > props.maxBytes || props.marks.length > 0 || props.errors.length > 0,
)
let offsets = [0]
let frame = 0
let observer: ResizeObserver | undefined
let textNode: Text | undefined
let mirrored = ''
const tops = new Map<number, number>()
function top(index: number): number {
  if (!input.value || !mirror.value || !textNode) return 0
  const cached = tops.get(index)
  if (cached !== undefined) return cached
  const range = document.createRange()
  const offset = offsets[index] ?? 0
  range.setStart(textNode, offset)
  range.setEnd(textNode, Math.min(offset + 1, textNode.length))
  const y = range.getBoundingClientRect().top - mirror.value.getBoundingClientRect().top
  tops.set(index, y)
  return y
}
function measure() {
  frame = 0
  const element = input.value
  const copy = mirror.value
  if (!element || !copy) return
  const width = `${element.clientWidth}px`
  if (
    mirrored !== props.modelValue ||
    !textNode ||
    copy.style.width !== width ||
    copy.style.whiteSpace !== (wrap.value ? 'pre-wrap' : 'pre')
  ) {
    mirrored = props.modelValue
    offsets = lineOffsets(mirrored)
    // A sentinel gives the trailing empty line a measurable native line box.
    textNode = document.createTextNode(mirrored + '\u200b')
    copy.replaceChildren(textNode)
    copy.style.width = width
    copy.style.whiteSpace = wrap.value ? 'pre-wrap' : 'pre'
    tops.clear()
  }
  numbers.value = props.lineNumbers
    ? visibleLines(offsets.length, top, element.scrollTop, element.clientHeight)
    : []
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(measure)
}
async function goToLine(line: number) {
  await nextTick()
  if (frame) cancelAnimationFrame(frame)
  measure()
  const element = input.value
  if (!element) return
  const index = Math.max(0, Math.min(offsets.length - 1, line - 1))
  element.focus()
  element.setSelectionRange(
    offsets[index]!,
    (offsets[index + 1] ?? props.modelValue.length + 1) - 1,
  )
  element.scrollTop = Math.max(0, top(index) - element.clientHeight / 3)
  schedule()
  announce(t('codeEditor.line', { line: format.number(index + 1) }))
}
defineExpose({ goToLine })
watch(() => [props.modelValue, wrap.value], schedule)
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
    <label :for="id" class="block text-sm font-medium text-gray-800 dark:text-gray-200">{{
      label
    }}</label>
    <div
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

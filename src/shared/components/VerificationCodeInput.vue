<script setup lang="ts">
// Six visual slots over one native textbox preserve autofill, paste, selection and one tab stop.
import { ref, useTemplateRef, watch } from 'vue'

defineOptions({ inheritAttrs: false })
const code = defineModel<string>({ required: true })
const input = useTemplateRef<HTMLInputElement>('input')
const focused = ref(false)
const start = ref(0)
const end = ref(0)
const digits = (value: string) => value.replace(/\D/g, '').slice(0, 6)

function updateSelection() {
  start.value = input.value?.selectionStart ?? code.value.length
  end.value = input.value?.selectionEnd ?? start.value
}

function onFocus() {
  focused.value = true
  updateSelection()
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value
  const selectionStart = digits(value.slice(0, target.selectionStart ?? value.length)).length
  const selectionEnd = digits(value.slice(0, target.selectionEnd ?? value.length)).length
  const clean = digits(value)
  target.value = clean
  code.value = clean
  target.setSelectionRange(selectionStart, selectionEnd)
  updateSelection()
}

function selectDigit(event: PointerEvent) {
  const target = input.value
  if (!target || target.disabled || event.button !== 0) return
  event.preventDefault()
  const bounds = target.getBoundingClientRect()
  const position = Math.floor(((event.clientX - bounds.left) / bounds.width) * 6)
  const index = Math.min(Math.max(position, 0), 5, code.value.length)
  target.focus()
  target.setSelectionRange(index, Math.min(index + 1, code.value.length))
  updateSelection()
}

function active(index: number) {
  return (
    focused.value &&
    (index === Math.min(start.value, 5) || (index >= start.value && index < end.value))
  )
}

watch(code, updateSelection, { flush: 'post' })
defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div
    data-code-input
    :data-invalid="$attrs['aria-invalid']"
    class="relative w-full min-w-0 max-w-md"
    dir="ltr"
  >
    <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- FormField forwards the label id and error descriptions through $attrs. -->
    <input
      ref="input"
      v-bind="$attrs"
      :value="code"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="16"
      spellcheck="false"
      autocapitalize="none"
      class="absolute inset-0 z-10 h-full w-full min-w-0 cursor-text rounded-lg border-0 bg-transparent p-0 text-base text-transparent caret-transparent outline-none selection:bg-transparent"
      @input="onInput"
      @focus="onFocus"
      @blur="focused = false"
      @select="updateSelection"
      @keyup="updateSelection"
      @pointerdown="selectDigit"
    />
    <div aria-hidden="true" class="pointer-events-none grid grid-cols-6 gap-2 sm:gap-4">
      <span
        v-for="index in 6"
        :key="index"
        data-code-digit
        :data-active="active(index - 1)"
        class="flex h-11 min-w-0 items-center justify-center rounded-lg border bg-white text-xl font-medium text-gray-900 tabular-nums shadow-theme-xs dark:bg-gray-900 dark:text-white"
        :class="
          $attrs['aria-invalid'] === 'true'
            ? 'border-red-600 dark:border-red-400'
            : active(index - 1)
              ? 'border-brand-500 ring-3 ring-brand-500/20'
              : 'border-gray-300 dark:border-gray-700'
        "
      >
        {{ code[index - 1] }}
        <span
          v-if="active(index - 1) && !code[index - 1]"
          class="h-5 w-px bg-gray-800 dark:bg-white"
        />
      </span>
    </div>
  </div>
</template>

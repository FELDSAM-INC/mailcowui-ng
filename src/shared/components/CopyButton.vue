<script setup lang="ts">
// A copy button (conventions "Shared building blocks"; UI 010 research R6, FR-074, FR-075). It
// copies exactly `text`, says so with the classic interface's "Text copied to clipboard!" (also
// announced politely) and keeps that state while it has the focus or the pointer, reverting two
// seconds after both left. When the browser refuses (or has no clipboard API), `selectTarget` is
// focused and its text selected in place, with a message to copy it by hand. At least 44 × 44 px;
// the visible text is "Copy" and the accessible name says what is copied.
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

import { announce } from '../composables/useAnnouncer'
import { CheckIcon, CopyIcon } from '../icons'
import { copyText } from '../platform/clipboard'
import { buttonVariants } from '../ui/button'

const props = withDefaults(
  defineProps<{
    text: string
    /** The accessible name, for example "Copy record value of example.org". */
    label: string
    /** The element whose text is selected when the browser refuses. */
    selectTarget?: HTMLElement | null
    /** Shows only the icon (the name stays the label). */
    iconOnly?: boolean
  }>(),
  { selectTarget: null, iconOnly: false },
)

const { t } = useI18n()
const outcome = ref<'copied' | 'refused' | null>(null)
let focused = false
let hovered = false
let timer: ReturnType<typeof setTimeout> | undefined

function stopTimer() {
  if (timer) clearTimeout(timer)
  timer = undefined
}

/** Reverts two seconds after the button has neither the focus nor the pointer (FR-074). */
function scheduleRevert() {
  stopTimer()
  if (outcome.value !== 'copied' || focused || hovered) return
  timer = setTimeout(() => {
    timer = undefined
    outcome.value = null
  }, 2000)
}

function selectInPlace() {
  const target = props.selectTarget
  if (!target) return
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus()
  const range = document.createRange()
  range.selectNodeContents(target)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

async function copy() {
  stopTimer()
  const result = await copyText(props.text)
  outcome.value = result
  if (result === 'copied') {
    announce(lt('admin.copy_to_clipboard'))
    scheduleRevert()
  } else {
    selectInPlace()
    announce(t('common.copy.refused'), { assertive: true })
  }
}

function onFocus() {
  focused = true
  stopTimer()
}
function onBlur() {
  focused = false
  scheduleRevert()
}
function onEnter() {
  hovered = true
  stopTimer()
}
function onLeave() {
  hovered = false
  scheduleRevert()
}

onBeforeUnmount(stopTimer)
</script>

<template>
  <span class="inline-flex flex-col items-start gap-1">
    <button
      type="button"
      :class="buttonVariants({ variant: 'outline', size: 'sm' })"
      class="min-h-11 min-w-11"
      :aria-label="label"
      :data-copied="outcome === 'copied' ? '' : undefined"
      @click="copy"
      @focus="onFocus"
      @blur="onBlur"
      @pointerenter="onEnter"
      @pointerleave="onLeave"
    >
      <CheckIcon v-if="outcome === 'copied'" class="size-4" />
      <CopyIcon v-else class="size-4" />
      <span :class="iconOnly ? 'sr-only' : 'max-sm:sr-only'">{{ t('secrets.copy') }}</span>
    </button>
    <span
      v-if="outcome === 'copied'"
      role="status"
      class="text-sm font-medium text-green-700 dark:text-green-400"
    >
      {{ lt('admin.copy_to_clipboard') }}
    </span>
    <span
      v-else-if="outcome === 'refused'"
      role="alert"
      class="text-sm text-red-700 dark:text-red-300"
    >
      {{ t('common.copy.refused') }}
    </span>
  </span>
</template>

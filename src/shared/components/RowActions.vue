<script setup lang="ts">
import { nextTick, onUnmounted, provide, ref } from 'vue'
import { HorizontalDotsIcon } from '@/shared/icons'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { rowActionTrigger } from './row-actions'

withDefaults(defineProps<{ count: number; label: string; disabled?: boolean }>(), {
  disabled: false,
})
const root = ref<HTMLElement | null>(null)
let finishClosing: (() => void) | undefined
function onCloseAutoFocus(event: Event) {
  if (!finishClosing) return
  // A selected action may open a dialog. Let the menu finish its exit animation before
  // handing focus to that action, so its old focus scope cannot interfere with the dialog.
  event.preventDefault()
  finishClosing()
  finishClosing = undefined
}
onUnmounted(() => finishClosing?.())
provide(rowActionTrigger, async () => {
  await new Promise<void>((resolve) => {
    finishClosing = resolve
  })
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const trigger = root.value?.querySelector<HTMLElement>('[data-row-action-trigger]') ?? null
  trigger?.focus()
  return trigger
})
</script>

<template>
  <span v-if="count > 0" ref="root" class="inline-flex shrink-0" data-row-actions>
    <DropdownMenu v-if="count > 1">
      <DropdownMenuTrigger
        data-row-action-trigger
        :aria-label="label"
        :disabled="disabled"
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <HorizontalDotsIcon class="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        class="max-w-[min(24rem,calc(100vw-2rem))]"
        @close-auto-focus="onCloseAutoFocus"
      >
        <slot :menu="true" />
      </DropdownMenuContent>
    </DropdownMenu>
    <slot v-else :menu="false" />
  </span>
</template>

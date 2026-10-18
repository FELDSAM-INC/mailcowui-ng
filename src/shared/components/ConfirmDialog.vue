<script setup lang="ts">
// The confirmation host (conventions "Confirmations", research R20): a Reka AlertDialog, so it is
// announced, traps focus and closes with Escape (which cancels). Focus returns to the element that
// was focused before it opened. One instance lives in App.vue.
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { computed, shallowRef, watch } from 'vue'
import { lt } from '@/i18n'

import { confirmState, settleConfirm, type ConfirmRequest } from '../composables/useConfirm'
import { buttonVariants } from '../ui/button'

const open = computed(() => confirmState.value !== null)
// The texts stay while the dialog closes.
const shown = shallowRef<ConfirmRequest | null>(null)
let returnFocus: HTMLElement | null = null

watch(
  confirmState,
  (request) => {
    if (!request) return
    shown.value = request
    returnFocus = request.returnFocus
  },
  { immediate: true },
)

function onOpenChange(next: boolean) {
  if (!next) settleConfirm(false)
}

function onCloseAutoFocus(event: Event) {
  event.preventDefault()
  const target = returnFocus
  returnFocus = null
  if (target?.isConnected) target.focus()
}
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="onOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay
        class="fixed inset-0 z-100 bg-black/50 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 dark:bg-black/70"
      />
      <AlertDialogContent
        class="fixed start-1/2 top-1/2 z-101 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700 shadow-theme-lg outline-none sm:max-w-lg rtl:translate-x-1/2 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
        @close-auto-focus="onCloseAutoFocus"
      >
        <AlertDialogTitle class="text-lg font-semibold break-words text-gray-900 dark:text-white">
          {{ shown?.title }}
        </AlertDialogTitle>
        <AlertDialogDescription v-if="shown?.description" class="break-words">
          {{ shown.description }}
        </AlertDialogDescription>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AlertDialogCancel :class="buttonVariants({ variant: 'outline' })">
            {{ shown?.cancelLabel ?? lt('footer.cancel') }}
          </AlertDialogCancel>
          <button
            type="button"
            :class="buttonVariants({ variant: shown?.destructive ? 'destructive' : 'default' })"
            @click="settleConfirm(true)"
          >
            {{ shown?.confirmLabel }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

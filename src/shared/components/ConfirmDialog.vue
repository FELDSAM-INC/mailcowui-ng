<script setup lang="ts">
// The confirmation host (conventions "Confirmations", research R20): a Reka AlertDialog, so it is
// announced, traps focus and closes with Escape (which cancels). Focus returns to the element that
// was focused before it opened. One instance lives in App.vue. UI 002 adds a typed confirmation
// (the confirm action stays disabled until an accepted value is typed), rich content and
// information dialogs with a single close action.
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { computed, nextTick, ref, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

import {
  confirmState,
  matchesTyped,
  settleConfirm,
  type ConfirmRequest,
} from '../composables/useConfirm'
import { buttonVariants } from '../ui/button'

const { t } = useI18n()
const open = computed(() => confirmState.value !== null)
// The texts stay while the dialog closes.
const shown = shallowRef<ConfirmRequest | null>(null)
const typed = ref('')
const typedId = useId()
// UI 006: the acknowledgement of a high-risk action.
const acknowledged = ref(false)
let returnFocus: HTMLElement | null = null

watch(
  confirmState,
  (request) => {
    if (!request) return
    shown.value = request
    typed.value = ''
    acknowledged.value = false
    returnFocus = request.returnFocus
  },
  { immediate: true },
)

const confirmDisabled = computed(() => {
  const rule = shown.value?.requireTyped
  if (shown.value?.acknowledge && !acknowledged.value) return true
  return !!rule && !matchesTyped(typed.value, rule)
})

function onOpenChange(next: boolean) {
  if (!next) settleConfirm(false)
}

function onConfirm() {
  if (confirmDisabled.value) return
  settleConfirm(true)
}

function onFocusIn(event: FocusEvent) {
  const target = event.target
  const content = event.currentTarget
  if (!(target instanceof HTMLElement) || !(content instanceof HTMLElement)) return
  const field = target.getBoundingClientRect()
  const viewport = content.getBoundingClientRect()
  // Reka intentionally uses preventScroll when focusing Cancel. In a short viewport that
  // action can be below the visible portion of this scrollable dialog.
  if (field.top < viewport.top || field.bottom > viewport.bottom) {
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

async function onCloseAutoFocus(event: Event) {
  event.preventDefault()
  const target = returnFocus
  returnFocus = null
  const active = document.activeElement
  const closingDialog = active?.closest('[role="alertdialog"]')
  const canRestore = active === document.body || active === target || !!closingDialog
  // Callers can disable their trigger while awaiting confirmation. Let their finally block
  // reenable it before restoring focus, without overriding a deliberate move elsewhere.
  await nextTick()
  const current = document.activeElement
  if (
    !open.value &&
    target?.isConnected &&
    canRestore &&
    (current === document.body || current === active || closingDialog?.contains(current))
  )
    target.focus()
}
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="onOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay
        class="fixed inset-0 z-100 bg-black/50 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 dark:bg-black/70"
      />
      <AlertDialogContent
        class="fixed start-1/2 top-1/2 z-101 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700 shadow-theme-lg outline-none sm:max-w-lg rtl:translate-x-1/2 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
        @close-auto-focus="onCloseAutoFocus"
        @focusin="onFocusIn"
      >
        <AlertDialogTitle class="text-lg font-semibold break-words text-gray-900 dark:text-white">
          {{ shown?.title }}
        </AlertDialogTitle>
        <AlertDialogDescription v-if="shown?.description" class="break-words">
          {{ shown.description }}
        </AlertDialogDescription>
        <component
          :is="shown.content.component"
          v-if="shown?.content"
          v-bind="shown.content.props ?? {}"
        />
        <label
          v-if="shown?.acknowledge"
          data-acknowledge
          class="inline-flex min-h-11 items-center gap-3 font-medium text-gray-800 dark:text-gray-200"
        >
          <input v-model="acknowledged" type="checkbox" class="size-5 shrink-0 accent-accent" />
          <span class="min-w-0">{{ shown.acknowledge.label }}</span>
        </label>
        <div v-if="shown?.requireTyped" class="flex flex-col gap-1.5">
          <label :for="typedId" class="font-medium text-gray-800 dark:text-gray-200">
            {{ t(shown.requireTyped.labelKey, shown.requireTyped.labelParams ?? {}) }}
          </label>
          <input
            :id="typedId"
            v-model="typed"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            @keydown.enter.prevent="onConfirm"
          />
        </div>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AlertDialogCancel
            v-if="shown?.alertOnly"
            :class="buttonVariants({ variant: 'default' })"
          >
            {{ shown.confirmLabel }}
          </AlertDialogCancel>
          <template v-else>
            <AlertDialogCancel :class="buttonVariants({ variant: 'outline' })">
              {{ shown?.cancelLabel ?? lt('footer.cancel') }}
            </AlertDialogCancel>
            <button
              type="button"
              :class="buttonVariants({ variant: shown?.destructive ? 'destructive' : 'default' })"
              :disabled="confirmDisabled"
              @click="onConfirm"
            >
              {{ shown?.confirmLabel }}
            </button>
          </template>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

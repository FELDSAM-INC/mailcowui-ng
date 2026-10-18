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
import { computed, ref, shallowRef, useId, watch } from 'vue'
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
let returnFocus: HTMLElement | null = null

watch(
  confirmState,
  (request) => {
    if (!request) return
    shown.value = request
    typed.value = ''
    returnFocus = request.returnFocus
  },
  { immediate: true },
)

const confirmDisabled = computed(() => {
  const rule = shown.value?.requireTyped
  return !!rule && !matchesTyped(typed.value, rule)
})

function onOpenChange(next: boolean) {
  if (!next) settleConfirm(false)
}

function onConfirm() {
  if (confirmDisabled.value) return
  settleConfirm(true)
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
        class="fixed start-1/2 top-1/2 z-101 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700 shadow-theme-lg outline-none sm:max-w-lg rtl:translate-x-1/2 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
        @close-auto-focus="onCloseAutoFocus"
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

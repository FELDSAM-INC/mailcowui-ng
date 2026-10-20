<script setup lang="ts">
// The navigation below the lg breakpoint (FR-046, research R21): a Reka Dialog styled like
// TailAdmin's sidebar. It traps focus, closes with Escape and after a choice, and returns focus to
// the header button.
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import type { Identity } from '@/api'
import { CloseIcon } from '@/shared/icons'

import BrandLogo from './BrandLogo.vue'
import NavigationList from './NavigationList.vue'

defineProps<{ identity: Identity | null | undefined; returnFocus: HTMLElement | null }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()

function restoreFocus(event: Event, target: HTMLElement | null) {
  event.preventDefault()
  target?.focus()
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/50 dark:bg-black/70" />
      <DialogContent
        :aria-describedby="undefined"
        class="fixed inset-y-0 start-0 z-101 flex w-[min(20rem,85vw)] flex-col gap-4 overflow-hidden border-e border-gray-200 bg-white p-4 shadow-theme-lg outline-none dark:border-gray-800 dark:bg-gray-900"
        @close-auto-focus="restoreFocus($event, returnFocus)"
      >
        <div class="flex shrink-0 items-center justify-between gap-3">
          <DialogTitle class="sr-only">{{ t('a11y.mainNavigation') }}</DialogTitle>
          <BrandLogo />
          <button
            type="button"
            class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/5"
            :aria-label="t('a11y.closeNavigation')"
            @click="open = false"
          >
            <CloseIcon class="size-5" />
          </button>
        </div>
        <div
          data-sidebar-scroll
          class="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <NavigationList :identity="identity" @navigate="open = false" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

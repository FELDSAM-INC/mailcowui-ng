<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, ref, type HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import { Button } from '@/shared/ui/button'
import { CloseIcon } from '@/shared/icons'
import { cn } from '@/shared/ui/utils/cn'
import { focusFirstFieldOnOpen } from '@/shared/ui/utils/focusOnOpen'
import DialogOverlay from './DialogOverlay.vue'

// Deviation: user-facing text comes from the app's translations (constitution IV).
const { t } = useI18n()

const props = withDefaults(
  defineProps<
    DialogContentProps & {
      class?: HTMLAttributes['class']
      showCloseButton?: boolean
      fullScreen?: boolean
    }
  >(),
  {
    showCloseButton: true,
    fullScreen: false,
  },
)
const emits = defineEmits<DialogContentEmits>()

const delegated = computed(() => {
  const { class: _class, showCloseButton: _show, fullScreen: _full, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const content = ref<{ $el: HTMLElement } | null>(null)

const onOpenAutoFocus = (event: Event) => focusFirstFieldOnOpen(event, content.value?.$el)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      ref="content"
      data-slot="dialog-content"
      v-bind="forwarded"
      :class="
        cn(
          fullScreen
            ? `fixed inset-0 z-101 flex flex-col justify-between w-screen h-dvh max-w-none rounded-none border-none bg-white p-6 sm:p-10 text-sm text-gray-700 shadow-none duration-100 outline-none overflow-y-auto data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 dark:bg-surface dark:text-gray-300`
            : `fixed start-1/2 top-1/2 z-101 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700 shadow-theme-lg duration-100 outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 sm:max-w-lg rtl:translate-x-1/2 dark:border-gray-800 dark:bg-surface dark:text-gray-300`,
          props.class,
        )
      "
      @open-auto-focus="onOpenAutoFocus"
    >
      <slot />
      <DialogClose v-if="showCloseButton" data-slot="dialog-close" as-child>
        <Button
          variant="ghost"
          :class="
            cn(
              'rounded-full text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white',
              fullScreen
                ? 'absolute end-4 top-4 size-11 bg-gray-100 hover:bg-gray-200 sm:end-6 sm:top-6 dark:bg-gray-800 dark:hover:bg-gray-700'
                : 'absolute end-3 top-3',
            )
          "
          :size="fullScreen ? 'icon-lg' : 'icon-sm'"
        >
          <CloseIcon :class="fullScreen ? 'size-6' : undefined" />
          <span class="sr-only">{{ t('common.close') }}</span>
        </Button>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>

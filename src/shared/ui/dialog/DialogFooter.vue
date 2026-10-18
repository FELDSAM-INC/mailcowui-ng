<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogClose } from 'reka-ui'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/ui/utils/cn'

// Deviation: user-facing text comes from the app's translations (constitution IV).
const { t } = useI18n()

const props = withDefaults(
  defineProps<{ class?: HTMLAttributes['class']; showCloseButton?: boolean }>(),
  {
    showCloseButton: false,
  },
)
</script>

<template>
  <div
    data-slot="dialog-footer"
    :class="
      cn(
        `-mx-6 -mb-6 flex flex-col-reverse gap-3 rounded-b-2xl p-4 sm:flex-row sm:justify-end`,
        props.class,
      )
    "
  >
    <slot />
    <DialogClose v-if="showCloseButton" as-child>
      <Button variant="outline">{{ t('common.close') }}</Button>
    </DialogClose>
  </div>
</template>

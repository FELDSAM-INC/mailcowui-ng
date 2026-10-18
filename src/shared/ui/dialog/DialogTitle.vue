<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { DialogTitle, useForwardProps } from 'reka-ui'
import type { DialogTitleProps } from 'reka-ui'
import { cn } from '@/shared/ui/utils/cn'

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes['class'] }>()

const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <DialogTitle
    data-slot="dialog-title"
    v-bind="forwarded"
    :class="cn(`text-lg font-semibold text-gray-800 dark:text-white/90`, props.class)"
  >
    <slot />
  </DialogTitle>
</template>

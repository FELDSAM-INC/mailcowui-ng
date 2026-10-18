<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { DialogDescription, useForwardProps } from 'reka-ui'
import type { DialogDescriptionProps } from 'reka-ui'
import { cn } from '@/shared/ui/utils/cn'

const props = defineProps<DialogDescriptionProps & { class?: HTMLAttributes['class'] }>()

const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <DialogDescription
    data-slot="dialog-description"
    v-bind="forwarded"
    :class="cn(`text-sm text-gray-500 dark:text-gray-400`, props.class)"
  >
    <slot />
  </DialogDescription>
</template>

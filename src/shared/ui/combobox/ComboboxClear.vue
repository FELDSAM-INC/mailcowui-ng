<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { ComboboxCancel, useForwardProps } from 'reka-ui'
import type { ComboboxCancelProps } from 'reka-ui'
import { Button } from '@/shared/ui/button'
import { CloseIcon } from '@/shared/icons'
import { cn } from '@/shared/ui/utils/cn'

const props = defineProps<ComboboxCancelProps & { class?: HTMLAttributes['class'] }>()

const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <ComboboxCancel data-slot="combobox-clear" v-bind="forwarded" as-child>
    <Button
      variant="ghost"
      size="icon-xs"
      :class="
        cn(
          'text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          props.class,
        )
      "
    >
      <slot>
        <CloseIcon class="pointer-events-none size-4" />
      </slot>
    </Button>
  </ComboboxCancel>
</template>

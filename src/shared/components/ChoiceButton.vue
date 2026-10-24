<script setup lang="ts">
import { buttonVariants } from '@/shared/ui/button'
defineProps<{ pressed: boolean; disabled?: boolean }>()
</script>
<template>
  <button
    type="button"
    :aria-pressed="pressed"
    :disabled="disabled"
    :class="
      buttonVariants({
        variant: pressed ? 'default' : 'outline',
        class: 'h-auto min-h-11 whitespace-normal text-start',
      })
    "
  >
    <slot />
  </button>
</template>

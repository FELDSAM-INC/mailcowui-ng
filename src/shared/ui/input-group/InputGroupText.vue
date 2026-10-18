<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
</script>

<template>
  <span
    v-bind="{ ...attrs, class: undefined }"
    :class="
      cn(
        `flex items-center gap-2 text-sm font-normal text-gray-500 dark:text-gray-400 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4`,
        attrs.class as string,
      )
    "
  >
    <slot />
  </span>
</template>

<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
</script>

<template>
  <div
    data-slot="card-title"
    v-bind="{ ...attrs, class: undefined }"
    :class="
      cn(
        'mb-2 text-theme-xl font-medium text-gray-800 group-data-[size=sm]/card:mb-1 dark:text-white/90 [div[data-slot=card-header]_&]:mb-0',
        attrs.class as string,
      )
    "
  >
    <slot />
  </div>
</template>

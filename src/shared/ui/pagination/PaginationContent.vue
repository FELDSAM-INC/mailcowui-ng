<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
</script>

<template>
  <ul
    data-slot="pagination-content"
    v-bind="{ ...attrs, class: undefined }"
    :class="cn('flex items-center gap-0.5', attrs.class as string)"
  >
    <slot />
  </ul>
</template>

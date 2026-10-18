<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
</script>

<template>
  <div
    data-slot="card-description"
    v-bind="{ ...attrs, class: undefined }"
    :class="cn('text-sm leading-normal text-gray-500 dark:text-gray-400', attrs.class as string)"
  >
    <slot />
  </div>
</template>

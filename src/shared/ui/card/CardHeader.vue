<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
</script>

<template>
  <div
    data-slot="card-header"
    v-bind="{ ...attrs, class: undefined }"
    :class="cn('flex flex-col gap-2 group-data-[size=sm]/card:gap-1', attrs.class as string)"
  >
    <slot />
  </div>
</template>

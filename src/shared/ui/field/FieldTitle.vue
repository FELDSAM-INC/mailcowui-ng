<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
</script>

<template>
  <div
    data-slot="field-label"
    v-bind="{ ...attrs, class: undefined }"
    :class="
      cn(
        'flex w-fit items-center gap-2 text-sm font-medium text-gray-700 group-data-[disabled=true]/field:opacity-50 dark:text-gray-300',
        attrs.class as string,
      )
    "
  >
    <slot />
  </div>
</template>

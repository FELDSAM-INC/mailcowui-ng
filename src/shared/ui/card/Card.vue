<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{ size?: 'default' | 'sm' }>(), { size: 'default' })

const attrs = useAttrs()
</script>

<template>
  <div
    data-slot="card"
    :data-size="size"
    v-bind="{ ...attrs, class: undefined }"
    :class="
      cn(
        'group/card flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5 data-[size=sm]:p-4 sm:p-6 dark:border-gray-800 dark:bg-white/3',
        attrs.class as string,
      )
    "
  >
    <slot />
  </div>
</template>

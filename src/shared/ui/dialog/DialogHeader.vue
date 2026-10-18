<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div data-slot="dialog-header" :class="cn('flex flex-col gap-2', props.class)">
    <slot />
  </div>
</template>

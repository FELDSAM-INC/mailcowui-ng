<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <span
    data-slot="dropdown-menu-shortcut"
    :class="cn('ms-auto text-xs tracking-widest text-gray-400 dark:text-gray-500', props.class)"
  >
    <slot />
  </span>
</template>

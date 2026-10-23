<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { DropdownMenuSeparator, useForwardProps } from 'reka-ui'
import type { DropdownMenuSeparatorProps } from 'reka-ui'
import { cn } from '@/shared/ui/utils/cn'

const props = defineProps<DropdownMenuSeparatorProps & { class?: HTMLAttributes['class'] }>()

const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <DropdownMenuSeparator
    data-slot="dropdown-menu-separator"
    v-bind="forwarded"
    :class="cn(`-mx-3 my-1.5 h-px shrink-0 bg-line`, props.class)"
  >
  </DropdownMenuSeparator>
</template>

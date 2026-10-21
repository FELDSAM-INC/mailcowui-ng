<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { Label, useForwardProps } from 'reka-ui'
import type { LabelProps } from 'reka-ui'
import { cn } from '@/shared/ui/utils/cn'

const props = defineProps<LabelProps & { class?: HTMLAttributes['class'] }>()

const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <Label
    data-slot="label"
    v-bind="forwarded"
    :class="
      cn(
        'flex items-center gap-2 text-sm leading-none font-medium text-ink select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:text-muted',
        props.class,
      )
    "
  >
    <slot />
  </Label>
</template>

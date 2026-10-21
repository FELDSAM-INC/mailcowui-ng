<script setup lang="ts">
import { computed, inject } from 'vue'
import { RouterLink, useRouter, type RouteLocationRaw } from 'vue-router'
import { Button, buttonVariants } from '@/shared/ui/button'
import { DropdownMenuItem } from '@/shared/ui/dropdown-menu'
import { rowActionTrigger } from './row-actions'

const props = withDefaults(
  defineProps<{
    menu: boolean
    label: string
    to?: RouteLocationRaw
    disabled?: boolean
    destructive?: boolean
    /** A callback survives menu-item unmount while focus is returned to the row trigger. */
    onSelect?: (trigger: HTMLElement) => void
  }>(),
  { to: undefined, disabled: false, destructive: false, onSelect: undefined },
)
const router = useRouter()
const restoreTrigger = inject(rowActionTrigger, undefined)
const href = computed(() =>
  props.to === undefined ? undefined : router.resolve(props.to).fullPath,
)

async function select(event: Event) {
  if (props.disabled || props.to !== undefined) return
  const target = event.currentTarget as HTMLElement
  const onSelect = props.onSelect
  const trigger = (await restoreTrigger?.()) ?? target
  onSelect?.(trigger)
}
</script>

<template>
  <DropdownMenuItem
    v-if="menu"
    class="min-h-11"
    :aria-label="label"
    :to="href"
    :disabled="disabled"
    :variant="destructive ? 'destructive' : 'default'"
    @select="select"
  >
    <slot>{{ label }}</slot>
  </DropdownMenuItem>
  <RouterLink
    v-else-if="to !== undefined && !disabled"
    :to="to"
    :aria-label="label"
    :class="buttonVariants({ variant: 'outline', size: 'sm' })"
  >
    <slot>{{ label }}</slot>
  </RouterLink>
  <Button
    v-else
    :disabled="disabled"
    :aria-label="label"
    :variant="destructive ? 'destructive' : 'outline'"
    size="sm"
    @click="onSelect?.($event.currentTarget as HTMLElement)"
  >
    <slot>{{ label }}</slot>
  </Button>
</template>

<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

type BadgeVariant = 'light' | 'solid' | 'ghost'
import type { BadgeColor } from './types'
type BadgeSize = 'sm' | 'default' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariant
    color?: BadgeColor
    size?: BadgeSize
  }>(),
  {
    variant: 'light',
    color: 'gray',
    size: 'sm',
  },
)

const attrs = useAttrs()

const base =
  'group/badge inline-flex max-w-full min-w-0 items-center gap-1 align-middle text-start font-medium whitespace-normal wrap-anywhere transition-colors [&>svg]:pointer-events-none [&>svg]:shrink-0 [&>svg]:self-center'

const sizes: Record<BadgeSize, string> = {
  sm: 'min-h-5 rounded-lg px-2 py-0.5 text-xs leading-4 [&>svg]:size-3',
  default:
    'min-h-6 rounded-lg px-2.5 py-0.5 text-sm [&:has(>svg:first-child)]:ps-2 [&:has(>svg:last-child)]:pe-2 [&>svg]:size-3.5',
  lg: 'min-h-7 rounded-lg px-3 py-1 text-sm [&:has(>svg:first-child)]:ps-2.5 [&:has(>svg:last-child)]:pe-2.5 [&>svg]:size-3.5',
}

const light: Record<BadgeColor, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-primary/10 text-primary',
  error: 'bg-danger/10 text-danger',
  warning: 'bg-mailcow-brand/15 text-warning-800 dark:text-mailcow-brand',
  info: 'bg-info/10 text-info',
  gray: 'bg-row-hover text-muted',
  light: 'bg-row-hover text-muted',
  dark: 'bg-ink/10 text-ink',
}

const solid: Record<BadgeColor, string> = {
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-primary text-primary-foreground',
  error: 'bg-danger text-danger-foreground',
  warning: 'bg-mailcow-brand text-black',
  info: 'bg-info text-white dark:text-black',
  gray: 'bg-gray-700 text-white',
  light: 'bg-row-hover text-muted',
  dark: 'bg-gray-800 text-white',
}

const ghostBase =
  'bg-transparent px-0 py-0 [&:has(>svg:first-child)]:ps-0 [&:has(>svg:last-child)]:pe-0'

const ghost: Record<BadgeColor, string> = {
  primary: 'text-brand-500 dark:text-brand-400',
  success: 'text-green-600 dark:text-green-500',
  error: 'text-red-600 dark:text-red-500',
  warning: 'text-amber-600 dark:text-orange-400',
  info: 'text-sky-500',
  gray: 'text-gray-700 dark:text-gray-300',
  light: 'text-gray-700 dark:text-gray-300',
  dark: 'text-gray-800 dark:text-white',
}

const classes = computed(() =>
  cn(
    base,
    sizes[props.size],
    props.variant === 'light'
      ? light[props.color]
      : props.variant === 'solid'
        ? solid[props.color]
        : cn(ghostBase, ghost[props.color]),
    attrs.class as string,
  ),
)
</script>

<template>
  <span
    data-slot="badge"
    :data-variant="variant"
    :data-color="color"
    :data-size="size"
    v-bind="{ ...attrs, class: undefined }"
    :class="classes"
  >
    <slot />
  </span>
</template>

<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from 'reka-ui'
import type { SwitchRootEmits, SwitchRootProps } from 'reka-ui'
import { cn } from '@/shared/ui/utils/cn'

const props = withDefaults(
  defineProps<SwitchRootProps & { class?: HTMLAttributes['class']; size?: 'sm' | 'default' }>(),
  {
    size: 'default',
  },
)
const emits = defineEmits<SwitchRootEmits>()

const switchVariants = {
  default: {
    root: 'h-6 w-13 p-0.5',
    thumb: 'h-5 w-[30px] data-checked:translate-x-[18px] rtl:data-checked:-translate-x-[18px]',
  },
  sm: {
    root: 'h-5 w-11 p-[1.5px]',
    thumb: 'h-[17px] w-[26px] data-checked:translate-x-[15px] rtl:data-checked:-translate-x-[15px]',
  },
} as const

const currentVariant = computed(() => switchVariants[props.size] ?? switchVariants.default)

const delegated = computed(() => {
  const { class: _class, size: _size, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <SwitchRoot
    data-slot="switch"
    :data-size="size"
    v-bind="forwarded"
    :class="
      cn(
        `peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors outline-hidden select-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:outline-hidden dark:focus-visible:ring-brand-500/30 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 data-checked:bg-accent data-checked:hover:bg-accent-hover dark:data-checked:bg-accent dark:data-checked:hover:bg-accent-hover data-disabled:cursor-not-allowed data-disabled:bg-gray-100 data-disabled:hover:bg-gray-100 dark:data-disabled:bg-gray-800 dark:data-disabled:hover:bg-gray-800 data-disabled:data-checked:bg-gray-100 data-disabled:data-checked:hover:bg-gray-100 dark:data-disabled:data-checked:bg-gray-800 dark:data-disabled:data-checked:hover:bg-gray-800 group-has-focus-visible/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 aria-invalid:ring-3 aria-invalid:ring-error-500/20 dark:aria-invalid:ring-error-500/40`,
        currentVariant.root,
        props.class,
      )
    "
  >
    <SwitchThumb
      data-slot="switch-thumb"
      :class="
        cn(
          `pointer-events-none block shrink-0 rounded-full bg-white data-checked:bg-accent-foreground data-disabled:data-checked:bg-white shadow-theme-sm ring-0 transition-transform duration-150 ease-linear data-unchecked:translate-x-0 rtl:data-unchecked:translate-x-0`,
          currentVariant.thumb,
        )
      "
    />
  </SwitchRoot>
</template>

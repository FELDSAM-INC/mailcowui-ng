<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    orientation?: 'vertical' | 'horizontal' | 'responsive'
  }>(),
  {
    orientation: 'vertical',
  },
)

const attrs = useAttrs()

const orientationClasses = computed(() => {
  if (props.orientation === 'horizontal') {
    return 'flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px'
  }
  if (props.orientation === 'responsive') {
    return 'flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px'
  }
  return 'flex-col *:w-full [&>.sr-only]:w-auto'
})
</script>

<template>
  <div
    role="group"
    data-slot="field"
    :data-orientation="orientation"
    v-bind="{ ...attrs, class: undefined }"
    :class="
      cn(
        'group/field flex w-full gap-2 data-[invalid=true]:text-red-500 dark:data-[invalid=true]:text-red-400',
        orientationClasses,
        attrs.class as string,
      )
    "
  >
    <slot />
  </div>
</template>

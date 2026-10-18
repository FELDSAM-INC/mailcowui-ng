<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { alertVariants } from './variants'
import type { AlertVariant } from './variants'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ variant?: AlertVariant }>(), { variant: 'default' })

const attrs = useAttrs()

const classes = computed(() =>
  alertVariants({ variant: props.variant, class: attrs.class as string }),
)
</script>

<template>
  <div data-slot="alert" role="alert" v-bind="{ ...attrs, class: undefined }" :class="classes">
    <slot />
  </div>
</template>

<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { ComboboxRoot, useForwardPropsEmits } from 'reka-ui'
import type { ComboboxRootProps, ComboboxRootEmits } from 'reka-ui'

const props = defineProps<ComboboxRootProps>()
const emits = defineEmits<ComboboxRootEmits>()
const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <ComboboxRoot data-slot="combobox" v-bind="forwarded">
    <slot />
  </ComboboxRoot>
</template>

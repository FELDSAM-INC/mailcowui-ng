<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { ComboboxAnchor, useForwardProps } from 'reka-ui'
import type { ComboboxAnchorProps } from 'reka-ui'

const props = defineProps<ComboboxAnchorProps>()

const forwarded = useForwardProps(props)
</script>

<template>
  <ComboboxAnchor data-slot="combobox-anchor" v-bind="forwarded">
    <slot />
  </ComboboxAnchor>
</template>

<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { ComboboxPortal, useForwardProps } from 'reka-ui'
import type { ComboboxPortalProps } from 'reka-ui'

const props = defineProps<ComboboxPortalProps>()

const forwarded = useForwardProps(props)
</script>

<template>
  <ComboboxPortal data-slot="combobox-portal" v-bind="forwarded">
    <slot />
  </ComboboxPortal>
</template>

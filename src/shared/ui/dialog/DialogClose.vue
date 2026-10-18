<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { DialogClose, useForwardProps } from 'reka-ui'
import type { DialogCloseProps } from 'reka-ui'

const props = defineProps<DialogCloseProps>()

const forwarded = useForwardProps(props)
</script>

<template>
  <DialogClose data-slot="dialog-close" v-bind="forwarded">
    <slot />
  </DialogClose>
</template>

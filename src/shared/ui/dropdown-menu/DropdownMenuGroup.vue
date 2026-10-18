<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { DropdownMenuGroup, useForwardProps } from 'reka-ui'
import type { DropdownMenuGroupProps } from 'reka-ui'

const props = defineProps<DropdownMenuGroupProps>()

const forwarded = useForwardProps(props)
</script>

<template>
  <DropdownMenuGroup data-slot="dropdown-menu-group" v-bind="forwarded">
    <slot />
  </DropdownMenuGroup>
</template>

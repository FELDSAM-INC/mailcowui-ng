<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
</script>

<template>
  <table v-bind="{ ...attrs, class: undefined }" :class="['min-w-full', attrs.class]">
    <slot />
  </table>
</template>

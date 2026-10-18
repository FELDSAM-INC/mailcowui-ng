<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
defineOptions({ inheritAttrs: true })

withDefaults(defineProps<{ isHeader?: boolean }>(), { isHeader: false })
</script>

<template>
  <component :is="isHeader ? 'th' : 'td'">
    <slot />
  </component>
</template>

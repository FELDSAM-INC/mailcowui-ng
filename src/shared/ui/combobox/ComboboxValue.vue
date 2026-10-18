<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
defineProps<{ placeholder?: string }>()
</script>

<template>
  <span data-slot="combobox-value">
    <slot>{{ placeholder }}</slot>
  </span>
</template>

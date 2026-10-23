<script setup lang="ts">
// The identifying text and status share a line, wrapping together on narrow cells or cards.
</script>
<template>
  <div data-identity class="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1">
    <div data-identity-text class="min-w-0 max-w-full wrap-anywhere"><slot /></div>
    <slot name="badges" />
  </div>
</template>

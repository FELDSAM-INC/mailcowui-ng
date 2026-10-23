<script setup lang="ts">
// Compact labelled values. Group a dt/dd pair in a div; data-wide gives long values a full row.
// Inline pairs are reserved for short flags, such as the Yes/No marks on aliases.
withDefaults(defineProps<{ inline?: boolean }>(), { inline: false })
</script>

<template>
  <dl class="data-card-fields" :class="{ 'data-card-flags': inline }"><slot /></dl>
</template>

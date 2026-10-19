<script setup lang="ts">
// The MTA-STS section of the alias domain page (US4, FR-022): the alias domain publishes its target
// domain's policy.
defineProps<{ aliasDomain: string; targetDomain: string }>()
</script>

<template>
  <section data-alias-mta-sts-section />
</template>

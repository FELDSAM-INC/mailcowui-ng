<script setup lang="ts">
// The MTA-STS section of the domain page (legacy `templates/edit/domain.twig` #dmtasts; US4).
defineProps<{ domain: string }>()
</script>

<template>
  <section id="mta-sts" data-mta-sts-section />
</template>

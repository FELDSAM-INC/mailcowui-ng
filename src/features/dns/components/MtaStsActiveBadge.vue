<script setup lang="ts">
import ActiveBadge from '@/shared/components/ActiveBadge.vue'
defineProps<{ active: boolean }>()
</script>
<template><ActiveBadge data-mta-sts-active :active="active" /></template>

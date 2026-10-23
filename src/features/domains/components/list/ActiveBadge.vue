<script setup lang="ts">
import ActiveBadge from '@/shared/components/ActiveBadge.vue'
defineProps<{ active: boolean }>()
</script>
<template><ActiveBadge :active="active" /></template>

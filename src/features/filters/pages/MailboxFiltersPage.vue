<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import FilterList from '../components/FilterList.vue'
const route = useRoute()
const mailbox = computed(() => String(route.params.address ?? '').toLowerCase())
</script>
<template><FilterList :key="mailbox" :mailbox="mailbox" /></template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { legacy, lt } from '@/i18n'
import SectionNavigation from '@/shared/components/SectionNavigation.vue'
const route = useRoute()
const items = computed(() => [
  {
    id: 'rules',
    labelKey: legacy('admin.rspamd_settings_map'),
    to: '/system/rspamd-rules',
    current: route.name !== 'rspamd-effective-map',
  },
  {
    id: 'effective',
    labelKey: legacy('admin.active_rspamd_settings_map'),
    to: '/system/rspamd-effective-map',
    current: route.name === 'rspamd-effective-map',
  },
])
</script>
<template>
  <SectionNavigation :label="lt('admin.rspamd_settings_map')" :items="items" />
</template>

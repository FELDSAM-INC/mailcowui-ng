<script setup lang="ts">
import LegacyText from '@/shared/components/LegacyText.vue'
defineProps<{ active: boolean }>()
</script>
<template>
  <LegacyText
    v-if="active"
    k="add.activate_filter_warn"
    as="p"
    class="text-sm text-amber-900 dark:text-amber-200"
  />
</template>

<script setup lang="ts">
// A yes/no value of a routing list (active, spam filter) as the classic tables show it: legacy's
// `admin.yes` / `admin.no` glyphs, in text rather than colour (FR-070).
import LegacyText from '@/shared/components/LegacyText.vue'

defineProps<{ value: boolean }>()
</script>

<template>
  <LegacyText :k="value ? 'admin.yes' : 'admin.no'" :data-status="value ? 'yes' : 'no'" />
</template>

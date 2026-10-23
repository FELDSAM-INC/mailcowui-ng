<script setup lang="ts">
// A yes/no value of a routing list (active, spam filter) as the classic tables show it: legacy's
// `admin.yes` / `admin.no` glyphs, in text rather than colour (FR-070).
import YesNoMark from '@/shared/components/YesNoMark.vue'

defineProps<{ value: boolean }>()
</script>

<template>
  <YesNoMark :value="value" :data-status="value ? 'yes' : 'no'" />
</template>

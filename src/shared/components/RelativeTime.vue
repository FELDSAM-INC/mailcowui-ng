<script setup lang="ts">
// A relative time ("5 minutes ago") with the absolute time available as a title and as visually
// hidden text (FR-087, research R15).
import { computed } from 'vue'

import { toDate, useFormat, type DateValue } from '@/i18n/format'

const props = defineProps<{ value: DateValue }>()
const fmt = useFormat()
const date = computed(() => toDate(props.value))
const valid = computed(() => !Number.isNaN(date.value.getTime()))
const absolute = computed(() => fmt.dateTime(date.value))
</script>

<template>
  <time v-if="valid" :datetime="date.toISOString()" :title="absolute"
    >{{ fmt.relative(date) }}<span class="sr-only"> ({{ absolute }})</span></time
  >
</template>

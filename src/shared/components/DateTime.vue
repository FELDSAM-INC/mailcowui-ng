<script setup lang="ts">
// An absolute date and time in the user's locale and the device time zone (FR-087).
import { computed } from 'vue'

import { toDate, useFormat, type DateStyle, type DateValue } from '@/i18n/format'

const props = withDefaults(defineProps<{ value: DateValue; format?: DateStyle }>(), {
  format: 'dateTime',
})
const fmt = useFormat()
const date = computed(() => toDate(props.value))
const valid = computed(() => !Number.isNaN(date.value.getTime()))
</script>

<template>
  <time v-if="valid" :datetime="date.toISOString()">{{ fmt.dateTime(date, format) }}</time>
</template>

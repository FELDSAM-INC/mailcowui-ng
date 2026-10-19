<script setup lang="ts">
// The legend of the booking badges above the classic resource table (`tab-resources.twig`):
// each short text with its long legacy text.
import { lt } from '@/i18n'

import { BOOKING_OPTIONS } from '../booking'
</script>

<template>
  <dl data-booking-legend class="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
    <div v-for="option in BOOKING_OPTIONS" :key="option.rule" class="flex flex-wrap gap-1">
      <dt class="font-medium text-gray-900 dark:text-white">{{ lt(option.shortKey) }}</dt>
      <dd>– {{ lt(option.labelKey) }}</dd>
    </div>
  </dl>
</template>

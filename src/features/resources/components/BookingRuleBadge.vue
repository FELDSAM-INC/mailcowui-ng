<script setup lang="ts">
// A resource's booking rule as the classic list shows it (US7-AS5): legacy's short text
// ("Always free", "Soft limit", "Hard limit") with the hard limit's number, as text.
import type { Resource } from '@/api'

import { bookingBadge } from '../booking'

defineProps<{ resource: Pick<Resource, 'bookingRule' | 'bookingLimit'> }>()
</script>

<template>
  <span
    data-booking-badge
    class="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  >
    {{ bookingBadge(resource) }}
  </span>
</template>

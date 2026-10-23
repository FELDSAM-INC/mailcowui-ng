<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// A resource's booking rule as the classic list shows it (US7-AS5): legacy's short text
// ("Always free", "Soft limit", "Hard limit") with the hard limit's number, as text.
import type { Resource } from '@/api'

import { bookingBadge } from '../booking'

defineProps<{ resource: Pick<Resource, 'bookingRule' | 'bookingLimit'> }>()
</script>

<template>
  <Badge data-booking-badge color="gray">
    {{ bookingBadge(resource) }}
  </Badge>
</template>

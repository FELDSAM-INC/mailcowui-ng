<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

import type { AccountSecondFactorStatus } from '@/api'
import MessageText from '@/shared/components/MessageText.vue'
defineProps<{ status: AccountSecondFactorStatus }>()
</script>
<template>
  <Badge :color="status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'gray'"
    ><MessageText :k="`accounts.secondFactorStatus.${status}`"
  /></Badge>
</template>

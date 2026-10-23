<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// The virus state as a text badge (UI 006 FR-010, FR-079): legacy's `quarantine.high_danger` when
// the filter found a virus, otherwise `quarantine.neutral_danger`.
import { lt } from '@/i18n'

defineProps<{ virus: boolean }>()
</script>

<template>
  <Badge :data-virus="virus ? 'true' : 'false'" :color="virus ? 'error' : 'gray'">
    {{ lt(virus ? 'quarantine.high_danger' : 'quarantine.neutral_danger') }}
  </Badge>
</template>

<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// The active state as text (FR-006, FR-076): inactive records are marked by text, not colour alone.
import { lt } from '@/i18n'

defineProps<{ active: boolean }>()
</script>

<template>
  <Badge data-active-badge :color="active ? 'success' : 'gray'">
    {{ active ? lt('mailbox.active') : lt('mailbox.inactive') }}
  </Badge>
</template>

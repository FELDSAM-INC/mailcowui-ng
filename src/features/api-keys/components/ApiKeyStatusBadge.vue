<script setup lang="ts">
import { Badge, type BadgeColor } from '@/shared/ui/badge'

// A key's status in text with an icon, never by colour alone (FR-084).
import { computed } from 'vue'

import type { ApiKeyStatus } from '@/api'
import { text } from '@/i18n'
import { CloseIcon, WarningIcon } from '@/shared/icons'

const props = defineProps<{ status: ApiKeyStatus }>()

const STYLES: Record<ApiKeyStatus, BadgeColor> = {
  active: 'success',
  expired: 'warning',
  revoked: 'gray',
}
const ICONS = { active: null, expired: WarningIcon, revoked: CloseIcon } as const
const icon = computed(() => ICONS[props.status])
</script>

<template>
  <Badge data-status :color="STYLES[status]">
    <component :is="icon" v-if="icon" class="size-4" />{{ text(`enums.apiKeyStatus.${status}`) }}
  </Badge>
</template>

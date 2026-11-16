<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MailboxStatus } from '@/api'
import { text } from '@/i18n'
import ActiveBadge from '@/shared/components/ActiveBadge.vue'
import { Badge } from '@/shared/ui/badge'
import { statusLabelKey } from '../../labels'
defineProps<{ status: MailboxStatus; shared?: boolean }>()
const { t } = useI18n()
</script>
<template>
  <Badge v-if="status === 'loginDisabled'" :data-status="status" color="warning">{{
    text(statusLabelKey(status))
  }}</Badge>
  <ActiveBadge v-else :data-status="status" :active="status === 'active'" />
  <Badge v-if="shared" color="info">{{ t('mailboxes.shared.label') }}</Badge>
</template>

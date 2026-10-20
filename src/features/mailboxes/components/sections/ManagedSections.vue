<script setup lang="ts">
// Pushover stays in the classic mailbox detail position (#mpushover).
import { PushNotificationsSection } from '@/features/account'
import type { Mailbox } from '../../types'
defineProps<{ mailbox: Mailbox; section: 'pushover' }>()
</script>
<template>
  <PushNotificationsSection :mailbox="mailbox.address" embedded />
</template>

<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// The relay badge of the classic list (FR-006): "relay", "relay all recipients" or "relay
// non-existing mailboxes only"; nothing for other domains.
import { computed } from 'vue'
import { lt, type LegacyKey } from '@/i18n'

import { relayBadge, type RelayOptions } from '../../relay'

const props = defineProps<{ domain: RelayOptions }>()
const KEYS: Record<NonNullable<ReturnType<typeof relayBadge>>, LegacyKey> = {
  relay: 'mailbox.backup_mx',
  relayAllRecipients: 'mailbox.relay_all',
  relayUnknownOnly: 'mailbox.relay_unknown',
}
const badge = computed(() => relayBadge(props.domain))
</script>

<template>
  <Badge v-if="badge" color="info">
    {{ lt(KEYS[badge]) }}
  </Badge>
</template>

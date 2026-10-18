<script setup lang="ts">
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
  <span
    v-if="badge"
    class="inline-flex items-center rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-500/15 dark:text-sky-200"
  >
    {{ lt(KEYS[badge]) }}
  </span>
</template>

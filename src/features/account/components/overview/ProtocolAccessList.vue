<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { MailboxOverview } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import { Badge } from '@/shared/ui/badge'

defineProps<{ access: MailboxOverview['protocolAccess'] }>()
const { t } = useI18n()
// Protocol identifiers and their order are the literals of legacy tab-user-auth.twig.
const protocols = [
  ['imap', 'IMAP'],
  ['smtp', 'SMTP'],
  ['sieve', 'Sieve'],
  ['pop3', 'POP3'],
  ['activeSync', 'ActiveSync'],
  ['dav', 'CalDAV/CardDAV'],
] as const
</script>

<template>
  <div class="flex flex-col gap-2">
    <h3 class="font-medium text-gray-900 dark:text-white">{{ lt('user.protocols') }}:</h3>
    <LegacyText
      k="user.direct_protocol_access"
      as="p"
      class="text-sm text-gray-600 dark:text-gray-400"
    />
    <ul class="grid gap-2 sm:grid-cols-2" data-protocol-access>
      <li
        v-for="[key, label] in protocols"
        :key="key"
        :data-protocol="key"
        class="flex flex-wrap items-center gap-2"
      >
        <span>{{ label }}</span>
        <Badge :color="access[key] ? 'success' : 'gray'">
          {{
            t(
              access[key]
                ? 'account.overview.protocol.allowed'
                : 'account.overview.protocol.notAllowed',
            )
          }}
        </Badge>
      </li>
    </ul>
  </div>
</template>

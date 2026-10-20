<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { MailboxOverview } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import { CheckIcon, CloseIcon } from '@/shared/icons'

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
    <ul class="grid gap-2 sm:grid-cols-2" data-protocol-access>
      <li v-for="[key, label] in protocols" :key="key" class="flex items-center gap-2">
        <component :is="access[key] ? CheckIcon : CloseIcon" class="size-4 shrink-0" />
        <span
          >{{ label }}:
          {{
            t(
              access[key]
                ? 'account.overview.protocol.allowed'
                : 'account.overview.protocol.notAllowed',
            )
          }}</span
        >
      </li>
    </ul>
    <LegacyText k="user.direct_protocol_access" class="text-sm text-gray-600 dark:text-gray-400" />
  </div>
</template>

<script setup lang="ts">
// Legacy's "Last mail login": one line per protocol the mailbox may use ("IMAP @ …", "POP3 @ …",
// "SMTP @ …") and "SSO @ …", the labels hard-coded as in legacy; a service never used shows legacy's
// "No record", never "never". The column is left out when the server does not report last logins.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MailboxLastLogins, MailboxProtocolAccess } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'

const props = defineProps<{ logins: MailboxLastLogins; access: MailboxProtocolAccess }>()
const { t } = useI18n()
const fmt = useFormat()
const lines = computed(() =>
  [
    props.access.imap ? { key: 'imap', value: props.logins.imap } : null,
    props.access.pop3 ? { key: 'pop3', value: props.logins.pop3 } : null,
    props.access.smtp ? { key: 'smtp', value: props.logins.smtp } : null,
    { key: 'sso', value: props.logins.webmailSso },
  ].filter((line): line is { key: string; value: string | null } => line !== null),
)
</script>

<template>
  <ul class="flex flex-col gap-0.5 text-sm">
    <li v-for="line in lines" :key="line.key" :data-login="line.key">
      {{
        t(`mailboxes.lastLogin.${line.key}`, {
          time: line.value ? fmt.dateTime(line.value) : lt('user.no_record'),
        })
      }}
    </li>
  </ul>
</template>

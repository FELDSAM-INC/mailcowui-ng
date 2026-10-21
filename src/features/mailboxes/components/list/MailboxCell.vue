<script setup lang="ts">
// One value of a mailbox in the wide list, as legacy's `draw_mailbox_table()` renders it: quota
// "used/total" with "∞", the last logins per protocol, "-" for a password never changed, the
// in-use bar, the status, the identity provider by name, TLS and protocol flags as ✓ / ✗ with
// their text for assistive technology, the quarantine options by their legacy labels, and the tags.
// Values are text, never markup (FR-075).
import { useI18n } from 'vue-i18n'

import type { MailboxQuarantineCategory, MailboxQuarantineNotification } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import { useFormat } from '@/i18n/format'
import { CheckIcon, CloseIcon, TagIcon } from '@/shared/icons'

import type { ColumnId } from '../../columns'
import { useMailboxFieldDisplay } from '../../field-display'
import type { Mailbox } from '../../types'
import InUseBar from '../display/InUseBar.vue'
import LastLogins from '../display/LastLogins.vue'
import MailboxStatusBadge from '../display/MailboxStatusBadge.vue'
import QuotaText from '../display/QuotaText.vue'

withDefaults(defineProps<{ mailbox: Mailbox; column: ColumnId; compactLogins?: boolean }>(), {
  compactLogins: false,
})
const { t } = useI18n()
const fmt = useFormat()
const display = useMailboxFieldDisplay()

const NOTIFICATION: Record<MailboxQuarantineNotification, LegacyKey> = {
  never: 'user.never',
  hourly: 'user.hourly',
  daily: 'user.daily',
  weekly: 'user.weekly',
}
const CATEGORY: Record<MailboxQuarantineCategory, LegacyKey> = {
  rejected: 'user.q_reject',
  junk: 'user.q_add_header',
  all: 'user.q_all',
}
const PROTOCOL = {
  smtp: 'smtp',
  imap: 'imap',
  pop3: 'pop3',
  sieve: 'sieve',
  activeSync: 'activeSync',
  dav: 'dav',
} as const
const isProtocol = (column: ColumnId): column is keyof typeof PROTOCOL => column in PROTOCOL
const date = (value: string | null) => (value ? fmt.dateTime(value) : '-')
</script>

<template>
  <QuotaText v-if="column === 'quota'" :used="mailbox.quotaUsed" :quota="mailbox.quota" />
  <LastLogins
    v-else-if="column === 'lastMailLogin'"
    :logins="mailbox.lastLogins"
    :access="mailbox.protocolAccess"
    :compact="compactLogins"
  />
  <span v-else-if="column === 'passwordChangedAt'">{{ date(mailbox.passwordChangedAt) }}</span>
  <InUseBar v-else-if="column === 'inUse'" :percent="mailbox.percentUsed" />
  <span v-else-if="column === 'messages'" class="tabular-nums">{{
    fmt.number(mailbox.messageCount)
  }}</span>
  <MailboxStatusBadge v-else-if="column === 'status'" :status="mailbox.status" />
  <span v-else-if="column === 'displayName'" class="wrap-anywhere">{{ mailbox.displayName }}</span>
  <span v-else-if="column === 'domain'" class="wrap-anywhere">{{ mailbox.domainUnicode }}</span>
  <span v-else-if="column === 'authSource'">{{ display.source(mailbox.authSource) }}</span>
  <span
    v-else-if="
      column === 'tlsEnforceInbound' || column === 'tlsEnforceOutbound' || isProtocol(column)
    "
    :data-flag="
      (isProtocol(column) ? mailbox.protocolAccess[PROTOCOL[column]] : mailbox[column])
        ? 'on'
        : 'off'
    "
  >
    <template
      v-if="isProtocol(column) ? mailbox.protocolAccess[PROTOCOL[column]] : mailbox[column]"
    >
      <CheckIcon class="size-5 text-green-700 dark:text-green-400" />
      <span class="sr-only">{{ t('domains.values.yes') }}</span>
    </template>
    <template v-else>
      <CloseIcon class="size-5 text-red-700 dark:text-red-400" />
      <span class="sr-only">{{ t('domains.values.no') }}</span>
    </template>
  </span>
  <span v-else-if="column === 'quarantineNotification'">{{
    lt(NOTIFICATION[mailbox.quarantineNotification])
  }}</span>
  <span v-else-if="column === 'quarantineCategory'">{{
    lt(CATEGORY[mailbox.quarantineCategory])
  }}</span>
  <span v-else-if="column === 'createdAt'">{{ date(mailbox.createdAt) }}</span>
  <span v-else-if="column === 'modifiedAt'">{{ date(mailbox.modifiedAt) }}</span>
  <ul v-else-if="column === 'tags'" class="flex flex-wrap gap-1.5">
    <li
      v-for="tag in mailbox.tags"
      :key="tag"
      class="inline-flex max-w-full items-start gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-sm text-brand-800 dark:bg-brand-500/15 dark:text-brand-200"
    >
      <TagIcon class="mt-0.5 size-4 shrink-0" />
      <span class="min-w-0 wrap-anywhere">{{ tag }}</span>
    </li>
  </ul>
</template>

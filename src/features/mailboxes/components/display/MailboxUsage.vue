<script setup lang="ts">
// The usage figures of a mailbox (FR-015, docs/conventions.md "Detail pages"), display-only, as the
// classic mailbox list shows them in its columns and labelled with its keys: quota, in use,
// messages, last mail login (when reported) and last password change.
import type { MailboxCapabilities } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'

import type { Mailbox } from '../../types'
import InUseBar from './InUseBar.vue'
import LastLogins from './LastLogins.vue'
import QuotaText from './QuotaText.vue'

defineProps<{ mailbox: Mailbox; capabilities?: MailboxCapabilities }>()
const fmt = useFormat()
</script>

<template>
  <section
    data-mailbox-usage
    aria-labelledby="mailbox-usage-title"
    class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="mailbox-usage-title" class="sr-only">{{ lt('mailbox.stats') }}</h2>
    <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div data-figure="quota">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.domain_quota') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          <QuotaText :used="mailbox.quotaUsed" :quota="mailbox.quota" />
        </dd>
      </div>
      <div data-figure="inUse">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.in_use') }}</dt>
        <dd><InUseBar :percent="mailbox.percentUsed" /></dd>
      </div>
      <div data-figure="messages">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.msg_num') }}</dt>
        <dd class="text-gray-900 dark:text-white">{{ fmt.number(mailbox.messageCount) }}</dd>
      </div>
      <div v-if="capabilities?.lastLoginsReported !== false" data-figure="lastLogin">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.last_mail_login') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          <LastLogins :logins="mailbox.lastLogins" :access="mailbox.protocolAccess" />
        </dd>
      </div>
      <div data-figure="passwordChangedAt">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.last_pw_change') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          {{ mailbox.passwordChangedAt ? fmt.dateTime(mailbox.passwordChangedAt) : '-' }}
        </dd>
      </div>
    </dl>
  </section>
</template>

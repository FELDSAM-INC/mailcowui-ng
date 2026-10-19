<script setup lang="ts">
// A mailbox below md (FR-007): the address opens the mailbox, then the display name, the status,
// the quota with the in-use bar and the message count, labelled with legacy's column keys. The
// actions (FR-013) are separate controls. Values are text, never markup (FR-075).
import { useId } from 'vue'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'

import { readableAddress, type Mailbox } from '../../types'
import InUseBar from '../display/InUseBar.vue'
import MailboxStatusBadge from '../display/MailboxStatusBadge.vue'
import QuotaText from '../display/QuotaText.vue'

defineProps<{ mailbox: Mailbox }>()
const id = useId()
const fmt = useFormat()
</script>

<template>
  <li
    :data-entry="mailbox.address"
    class="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <article :aria-labelledby="`${id}-address`" class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <slot name="select" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
          <h3 :id="`${id}-address`" class="text-base font-semibold text-gray-900 dark:text-white">
            <RouterLink
              :to="{ name: 'mailbox-detail', params: { address: mailbox.address } }"
              class="inline-flex min-h-11 max-w-full items-center wrap-anywhere underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {{ readableAddress(mailbox) }}
            </RouterLink>
          </h3>
          <p
            v-if="mailbox.displayName"
            data-display-name
            class="text-sm wrap-anywhere text-gray-700 dark:text-gray-300"
          >
            {{ mailbox.displayName }}
          </p>
          <div><MailboxStatusBadge :status="mailbox.status" /></div>
        </div>
      </div>
      <dl class="grid grid-cols-1 gap-2 text-sm min-[400px]:grid-cols-2">
        <div>
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.domain_quota') }}</dt>
          <dd class="text-gray-900 dark:text-white">
            <QuotaText :used="mailbox.quotaUsed" :quota="mailbox.quota" />
          </dd>
        </div>
        <div>
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.in_use') }}</dt>
          <dd><InUseBar :percent="mailbox.percentUsed" /></dd>
        </div>
        <div>
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.msg_num') }}</dt>
          <dd class="text-gray-900 tabular-nums dark:text-white">
            {{ fmt.number(mailbox.messageCount) }}
          </dd>
        </div>
      </dl>
      <slot name="actions" />
    </article>
  </li>
</template>

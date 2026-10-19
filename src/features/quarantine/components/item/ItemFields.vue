<script setup lang="ts">
// The item's fields in legacy's order (UI 006 FR-019, legacy form map screen 2, D17, D20): subject,
// recipients ("address (TYPE)", the envelope recipient as "SMTP"), the From header and the SMTP
// sender, each under its legacy heading, then the fields the API adds with the labels legacy uses
// for the same data elsewhere: arrival, virus state, notification state, ID, queue ID, size,
// sending server address and, for administrators, the authenticated sender. Missing values are
// "-", as legacy shows them. Message data goes through PlainText. For administrators and domain
// administrators the envelope recipient links to its mailbox page's spam filter section, but only
// when the mailbox exists (`getMailbox` answers 200): a resource or a deleted mailbox stays text.
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { QuarantineItemDetails, QuarantineRecipient } from '@/api'
import { lt, text } from '@/i18n'
import { useFormat } from '@/i18n/format'
import DateTime from '@/shared/components/DateTime.vue'
import PlainText from '@/shared/components/PlainText.vue'

import { recipientMailboxOptions } from '../../api'
import NotifiedBadge from '../NotifiedBadge.vue'
import VirusBadge from '../VirusBadge.vue'

const props = defineProps<{
  item: QuarantineItemDetails
  /** Administrators and domain administrators: the recipient may link to its mailbox. */
  scoped: boolean
}>()
const { t } = useI18n()
const fmt = useFormat()

const recipients = computed<QuarantineRecipient[]>(
  () => props.item.content?.recipients ?? [{ address: props.item.recipient, source: 'envelope' }],
)
const subject = computed(() => props.item.content?.subject ?? props.item.subject)

const mailbox = useQuery(
  computed(() => ({
    ...recipientMailboxOptions(props.item.recipient),
    enabled: props.scoped && props.item.recipient !== '',
  })),
)
const linkable = (recipient: QuarantineRecipient) =>
  props.scoped &&
  recipient.source === 'envelope' &&
  recipient.address.toLowerCase() === props.item.recipient.toLowerCase() &&
  !!mailbox.data.value

const HEADING = 'text-lg font-semibold text-gray-900 dark:text-white'
</script>

<template>
  <section aria-labelledby="qitem-subject" class="flex flex-col gap-1">
    <h2 id="qitem-subject" :class="HEADING">{{ lt('quarantine.subj') }}</h2>
    <p data-field="subject" class="text-gray-900 dark:text-white">
      <PlainText :value="subject || '-'" />
    </p>
  </section>
  <section aria-labelledby="qitem-recipients" class="flex flex-col gap-1">
    <h2 id="qitem-recipients" :class="HEADING">{{ lt('quarantine.recipients') }}</h2>
    <ul v-if="recipients.length > 0" data-field="recipients" class="flex flex-col gap-1">
      <li
        v-for="(recipient, index) in recipients"
        :key="index"
        :data-recipient-source="recipient.source"
        class="text-gray-900 dark:text-white"
      >
        <RouterLink
          v-if="linkable(recipient)"
          data-recipient-link
          :to="{
            name: 'mailbox-detail',
            params: { address: item.recipient },
            hash: '#spam-filter',
          }"
          class="inline-flex min-h-11 max-w-full items-center text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
        >
          <PlainText :value="recipient.address" />
        </RouterLink>
        <PlainText v-else :value="recipient.address" />
        {{ ` (${text(`enums.quarantineRecipientSource.${recipient.source}`)})` }}
      </li>
    </ul>
    <p v-else class="text-gray-900 dark:text-white">-</p>
  </section>
  <section aria-labelledby="qitem-from" class="flex flex-col gap-1">
    <h2 id="qitem-from" :class="HEADING">{{ lt('quarantine.sender_header') }}</h2>
    <p data-field="from" class="text-gray-900 dark:text-white">
      <PlainText :value="item.content?.from || '-'" />
    </p>
  </section>
  <section aria-labelledby="qitem-sender" class="flex flex-col gap-1">
    <h2 id="qitem-sender" :class="HEADING">{{ lt('quarantine.sender') }}</h2>
    <p data-field="sender" class="text-gray-900 dark:text-white">
      <PlainText :value="item.sender || '-'" />
    </p>
  </section>
  <dl
    data-item-facts
    class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm min-[480px]:grid-cols-2 lg:grid-cols-4"
  >
    <div class="min-w-0">
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('quarantine.received') }}</dt>
      <dd class="text-gray-900 dark:text-white"><DateTime :value="item.arrivedAt" /></dd>
    </div>
    <div class="min-w-0">
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('quarantine.danger') }}</dt>
      <dd><VirusBadge :virus="item.virus" /></dd>
    </div>
    <div class="min-w-0">
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('quarantine.notified') }}</dt>
      <dd><NotifiedBadge :notified="item.notified" /></dd>
    </div>
    <div class="min-w-0">
      <dt class="text-gray-600 dark:text-gray-400">{{ t('lists.id') }}</dt>
      <dd data-field="id" class="text-gray-900 tabular-nums dark:text-white">{{ item.id }}</dd>
    </div>
    <div class="min-w-0">
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('quarantine.qid') }}</dt>
      <dd data-field="queueId" class="font-mono text-gray-900 dark:text-white">
        <PlainText :value="item.queueId" />
      </dd>
    </div>
    <div class="min-w-0">
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.message_size') }}</dt>
      <dd data-field="size" class="text-gray-900 tabular-nums dark:text-white">
        {{ fmt.bytes(item.size) }}
      </dd>
    </div>
    <div class="min-w-0">
      <dt class="text-gray-600 dark:text-gray-400">{{ t('quarantineUi.item.sourceAddress') }}</dt>
      <dd data-field="sourceAddress" class="text-gray-900 dark:text-white">
        <PlainText :value="item.sourceAddress || '-'" />
      </dd>
    </div>
    <div v-if="item.authenticatedSender !== undefined" class="min-w-0">
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.authed_user') }}</dt>
      <dd data-field="authenticatedSender" class="text-gray-900 dark:text-white">
        <PlainText :value="item.authenticatedSender || '-'" />
      </dd>
    </div>
  </dl>
</template>

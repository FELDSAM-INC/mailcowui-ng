<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

// A queued message as a card below md (FR-051): the queue ID as the item's heading (legacy shows an
// empty cell for a bounce's sender, decision 24), the queue as Postfix names it, the sender, the
// first recipient as "address (reason)" with the others behind "+ n more", the arrival time and the
// size, and "Show message". Slots: `select` (selection mode).
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import type { MailQueueMessage } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PlainText from '@/shared/components/PlainText.vue'
import RelativeTime from '@/shared/components/RelativeTime.vue'
import { buttonVariants } from '@/shared/ui/button'

import { recipientText } from '../presentation'

defineProps<{ message: MailQueueMessage; show: RouteLocationRaw }>()
const { t } = useI18n()
const fmt = useFormat()
</script>

<template>
  <DataCard
    :data-entry="message.id"
    :title-id="`queue-message-${message.id}`"
    :title="message.id"
    :details-label="t('operations.queue.moreRecipients', { count: message.recipients.length - 1 })"
  >
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template #badges>
      <span
        data-queue-name
        class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      >
        {{ message.queue }}
      </span>
    </template>
    <template #actions>
      <RouterLink
        :to="show"
        :data-show-message="message.id"
        :aria-describedby="`queue-message-${message.id}`"
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
      >
        {{ lt('queue.show_message') }}
      </RouterLink>
    </template>
    <DataCardFields>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.sender') }}</dt>
      <dd class="text-gray-900 dark:text-white"><PlainText :value="message.sender" /></dd>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.recipients') }}</dt>
      <dd class="text-gray-900 dark:text-white">
        <PlainText
          v-if="message.recipients[0]"
          data-first-recipient
          :value="recipientText(message.recipients[0])"
          as="p"
        />
      </dd>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.arrival_time') }}</dt>
      <dd class="text-gray-900 dark:text-white"><RelativeTime :value="message.arrivalTime" /></dd>
      <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.message_size') }}</dt>
      <dd class="text-gray-900 dark:text-white">{{ fmt.bytes(message.sizeBytes) }}</dd>
    </DataCardFields>
    <template v-if="message.recipients.length > 1" #details>
      <ul class="flex flex-col gap-1">
        <li v-for="(recipient, index) in message.recipients.slice(1)" :key="index">
          <PlainText :value="recipientText(recipient)" />
        </li>
      </ul>
    </template>
  </DataCard>
</template>

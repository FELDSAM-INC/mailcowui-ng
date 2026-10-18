<script setup lang="ts">
// The usage figures of a domain (FR-015, FR-016), display-only, as the classic domain list shows
// them in its columns and labelled with its keys (docs/conventions.md "Detail pages"): mailboxes and
// aliases against their limits, the quota allocated against the domain quota, the statistics
// (storage and messages) and the maximum size of a mailbox (the default mailbox size is left out,
// owner decision). The counts
// are the action area where UI 003 and UI 004 link mailboxes and aliases (data-model §9).
import { lt } from '@/i18n'
import type { Domain } from '@/api'

import { useDomainFormat } from '../../format'
import UsageMeter from '../list/UsageMeter.vue'

defineProps<{ domain: Domain }>()
const format = useDomainFormat()
</script>

<template>
  <section
    data-usage-summary
    aria-labelledby="usage-title"
    class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="usage-title" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ lt('mailbox.stats') }}
    </h2>
    <div class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
      <UsageMeter
        :label="lt('mailbox.mailboxes')"
        :used="domain.usage.mailboxes"
        :limit="domain.maxMailboxes"
        :left="domain.usage.mailboxesLeft"
        kind="count"
        usage-id="mailboxes"
      />
      <UsageMeter
        :label="lt('mailbox.aliases')"
        :used="domain.usage.aliases"
        :limit="domain.maxAliases"
        :left="domain.usage.aliasesLeft"
        kind="count"
        usage-id="aliases"
      />
      <UsageMeter
        :label="lt('mailbox.domain_quota')"
        :used="domain.usage.quotaAllocated"
        :limit="domain.domainQuota"
        kind="size"
        usage-id="quota"
      />
    </div>
    <dl class="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div data-figure="storageUsed">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.stats') }}</dt>
        <dd class="text-gray-900 dark:text-white">{{ format.size(domain.usage.storageUsed) }}</dd>
      </div>
      <div data-figure="messages">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.msg_num') }}</dt>
        <dd class="text-gray-900 dark:text-white">{{ format.count(domain.usage.messages) }}</dd>
      </div>
      <div data-figure="maxMailboxQuota">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.mailbox_quota') }}</dt>
        <dd class="text-gray-900 dark:text-white">{{ format.size(domain.maxMailboxQuota) }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { MailboxOverview } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import { CloseIcon } from '@/shared/icons'

const props = defineProps<{ overview: MailboxOverview }>()
const direct = computed(() => [
  ...props.overview.directAliases,
  ...props.overview.aliasDomainAddresses.map((entry) => ({
    address: entry.address,
    publicComment: lt('add.alias_domain'),
  })),
])
const aliasLists = computed(() => [
  {
    title: lt('user.direct_aliases'),
    help: 'user.direct_aliases_desc' as const,
    entries: direct.value,
  },
  {
    title: lt('user.shared_aliases'),
    help: 'user.shared_aliases_desc' as const,
    entries: props.overview.sharedAliases,
  },
])
</script>

<template>
  <dl class="flex flex-col gap-5 text-sm" data-address-lists>
    <div v-for="list in aliasLists" :key="list.help">
      <dt class="font-medium text-gray-900 dark:text-white">{{ list.title }}</dt>
      <dd class="mt-1">
        <ul v-if="list.entries.length" class="flex flex-col gap-1">
          <li v-for="entry in list.entries" :key="entry.address" class="wrap-anywhere">
            {{ entry.address
            }}<template v-if="entry.publicComment"> — {{ entry.publicComment }}</template>
          </li>
        </ul>
        <span v-else
          ><CloseIcon class="size-4" /><span class="sr-only">{{ lt('user.no_record') }}</span></span
        >
        <LegacyText :k="list.help" class="mt-1 text-gray-600 dark:text-gray-400" />
      </dd>
    </div>
    <div>
      <dt class="font-medium text-gray-900 dark:text-white">
        {{ lt('user.aliases_also_send_as') }}
      </dt>
      <dd class="mt-1 wrap-anywhere">
        <LegacyText v-if="overview.sendAs.anyAddress" k="user.sender_acl_disabled" />
        <template v-else-if="overview.sendAs.addresses.length">{{
          overview.sendAs.addresses.join(', ')
        }}</template>
        <span v-else
          ><CloseIcon class="size-4" /><span class="sr-only">{{ lt('user.no_record') }}</span></span
        >
      </dd>
    </div>
    <div>
      <dt class="font-medium text-gray-900 dark:text-white">
        {{ lt('user.aliases_send_as_all') }}
      </dt>
      <dd class="mt-1 wrap-anywhere">
        <template v-if="overview.sendAs.domains.length">{{
          overview.sendAs.domains.join(', ')
        }}</template>
        <span v-else
          ><CloseIcon class="size-4" /><span class="sr-only">{{ lt('user.no_record') }}</span></span
        >
      </dd>
    </div>
    <div>
      <dt class="font-medium text-gray-900 dark:text-white">{{ lt('user.is_catch_all') }}</dt>
      <dd class="mt-1 wrap-anywhere">
        <template v-if="overview.catchAllAddresses.length">{{
          overview.catchAllAddresses.join(', ')
        }}</template>
        <span v-else
          ><CloseIcon class="size-4" /><span class="sr-only">{{ lt('user.no_record') }}</span></span
        >
      </dd>
    </div>
  </dl>
</template>

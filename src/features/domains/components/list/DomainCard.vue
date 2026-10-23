<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

// A domain as a card below md (FR-006, FR-072): the name as heading with a link to the domain
// page, the state and relay badges, the usage pairs, storage and messages, the tags as filter
// buttons, and the remaining values behind a disclosure (FR-007). Slots: `select` (the selection
// checkbox, UI 002 US5) and `actions` (the entry actions, US4; UI 010 adds "DNS check").
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import type { Domain } from '@/api'

import { useDomainFormat } from '../../format'
import ActiveBadge from './ActiveBadge.vue'
import DomainEntryDetails from './DomainEntryDetails.vue'
import DomainNameText from '@/shared/components/DomainNameText.vue'
import RelayBadge from './RelayBadge.vue'
import TagChips from './TagChips.vue'
import UsageMeter from './UsageMeter.vue'

const props = defineProps<{ domain: Domain; canSeeDomainAdmins: boolean }>()
const emit = defineEmits<{ filterTag: [tag: string] }>()
const { t } = useI18n()
const format = useDomainFormat()
const id = computed(() => `domain-card-${props.domain.name.replace(/[^a-z0-9-]/g, '-')}`)
</script>

<template>
  <DataCard
    :data-entry="domain.name"
    :title-id="`${id}-name`"
    :to="{ name: 'domain-detail', params: { domain: domain.name } }"
    :details-id="`${id}-details`"
    :details-label="t('domains.list.detailsOf', { name: domain.unicodeName })"
  >
    <template #title>
      <DomainNameText :name="domain.name" :unicode-name="domain.unicodeName" />
    </template>
    <template #badges>
      <ActiveBadge :active="domain.active" />
      <RelayBadge :domain="domain" />
    </template>
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <div class="grid grid-cols-1 gap-3">
      <UsageMeter
        :label="lt('mailbox.mailboxes')"
        :used="domain.usage.mailboxes"
        :limit="domain.maxMailboxes"
        kind="count"
        usage-id="mailboxes"
      />
      <UsageMeter
        :label="lt('mailbox.aliases')"
        :used="domain.usage.aliases"
        :limit="domain.maxAliases"
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
    <DataCardFields>
      <div class="flex gap-1">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.stats') }}:</dt>
        <dd class="text-gray-900 dark:text-white">
          {{ t('domains.list.messagesCount', { count: format.count(domain.usage.messages) }) }}
          / {{ format.size(domain.usage.storageUsed) }}
        </dd>
      </div>
    </DataCardFields>
    <TagChips :tags="domain.tags" @filter="emit('filterTag', $event)" />

    <template #details>
      <DomainEntryDetails
        :data-entry-details="domain.name"
        :domain="domain"
        :can-see-domain-admins="canSeeDomainAdmins"
      />
    </template>
  </DataCard>
</template>

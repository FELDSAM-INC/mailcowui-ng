<script setup lang="ts">
// A domain as a card below md (FR-006, FR-072): the name as heading with a link to the domain
// page, the state and relay badges, the usage pairs, storage and messages, the tags as filter
// buttons, and the remaining values behind a disclosure (FR-007). Slots: `select` (the selection
// checkbox, UI 002 US5) and `actions` (the entry actions, US4; UI 010 adds "DNS check").
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import type { Domain } from '@/api'
import { ChevronDownIcon } from '@/shared/icons'

import { useDomainFormat } from '../../format'
import ActiveBadge from './ActiveBadge.vue'
import DomainEntryDetails from './DomainEntryDetails.vue'
import DomainNameText from './DomainNameText.vue'
import RelayBadge from './RelayBadge.vue'
import TagChips from './TagChips.vue'
import UsageMeter from './UsageMeter.vue'

const props = defineProps<{ domain: Domain; canSeeDomainAdmins: boolean }>()
const emit = defineEmits<{ filterTag: [tag: string] }>()
const { t } = useI18n()
const format = useDomainFormat()
const expanded = ref(false)
const id = computed(() => `domain-card-${props.domain.name.replace(/[^a-z0-9-]/g, '-')}`)
</script>

<template>
  <li
    :data-entry="domain.name"
    class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <article :aria-labelledby="`${id}-name`" class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <slot name="select" />
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
          <h3 :id="`${id}-name`" class="text-base font-semibold text-gray-900 dark:text-white">
            <RouterLink
              :to="{ name: 'domain-detail', params: { domain: domain.name } }"
              class="inline-flex min-h-11 items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <DomainNameText :name="domain.name" :unicode-name="domain.unicodeName" />
            </RouterLink>
          </h3>
          <div class="flex flex-wrap gap-1.5">
            <ActiveBadge :active="domain.active" />
            <RelayBadge :domain="domain" />
          </div>
        </div>
        <slot name="actions" />
      </div>
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
      <dl class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div class="flex gap-1">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.stats') }}:</dt>
          <dd class="text-gray-900 dark:text-white">
            {{ t('domains.list.messagesCount', { count: format.count(domain.usage.messages) }) }}
            / {{ format.size(domain.usage.storageUsed) }}
          </dd>
        </div>
      </dl>
      <TagChips :tags="domain.tags" @filter="emit('filterTag', $event)" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-2 text-sm font-medium text-brand-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-gray-800"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="`${id}-details`"
        :aria-label="t('domains.list.detailsOf', { name: domain.unicodeName })"
        @click="expanded = !expanded"
      >
        <ChevronDownIcon
          class="size-4 motion-safe:transition-transform"
          :class="expanded ? 'rotate-180' : ''"
        />
        {{ t('domains.list.details') }}
      </button>
      <div v-if="expanded" :id="`${id}-details`" :data-entry-details="domain.name">
        <DomainEntryDetails :domain="domain" :can-see-domain-admins="canSeeDomainAdmins" />
      </div>
    </article>
  </li>
</template>

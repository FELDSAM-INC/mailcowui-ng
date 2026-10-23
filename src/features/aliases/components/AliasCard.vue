<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

// An alias as a card below md (FR-007, FR-012): the address as heading with a link to the alias page,
// the badges, then the classic table's columns as labelled values (`draw_alias_table()`): goto
// address, domain, SOGo visible (only with the groupware), the comments, internal and active.
// Slots: `select` (selection mode, US6) and `actions` (the entry menu, US3).
import { computed } from 'vue'

import type { Alias } from '@/api'
import { lt } from '@/i18n'

import YesNoMark from '@/shared/components/YesNoMark.vue'

import AddressText from './AddressText.vue'
import AliasBadges from './AliasBadges.vue'
import AliasDomainText from './AliasDomainText.vue'
import DestinationSummary from './DestinationSummary.vue'

const props = defineProps<{
  alias: Alias
  groupwareEnabled: boolean | undefined
  canSeeOrphaned: boolean
}>()
const headingId = computed(() => `alias-card-${props.alias.id}`)
const comment = (value: string) => value || '-'
</script>

<template>
  <DataCard
    :data-entry="alias.id"
    :title-id="headingId"
    :to="{ name: 'alias-detail', params: { aliasId: alias.id } }"
  >
    <template #title>
      <AddressText :address="alias.address" :address-unicode="alias.addressUnicode" />
    </template>
    <template #badges><AliasBadges :alias="alias" :can-see-orphaned="canSeeOrphaned" /></template>
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <DataCardFields>
      <div data-wide>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.target_address') }}</dt>
        <dd class="min-w-0 text-gray-900 dark:text-white">
          <DestinationSummary :alias="alias" />
        </dd>
      </div>
      <div data-wide>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.domain') }}</dt>
        <dd class="min-w-0 text-gray-900 dark:text-white"><AliasDomainText :alias="alias" /></dd>
      </div>
      <div data-wide>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.public_comment') }}</dt>
        <dd class="min-w-0 break-words text-gray-900 dark:text-white">
          {{ comment(alias.publicComment) }}
        </dd>
      </div>
      <div data-wide>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.private_comment') }}</dt>
        <dd class="min-w-0 break-words text-gray-900 dark:text-white">
          {{ comment(alias.privateComment) }}
        </dd>
      </div>
    </DataCardFields>
    <DataCardFields inline>
      <div v-if="groupwareEnabled" class="flex gap-1.5" data-field="groupwareVisible">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.sogo_visible') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          <YesNoMark :value="alias.groupwareVisible" />
        </dd>
      </div>
      <div class="flex gap-1.5" data-field="internal">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.internal') }}</dt>
        <dd class="text-gray-900 dark:text-white"><YesNoMark :value="alias.internal" /></dd>
      </div>
      <div class="flex gap-1.5" data-field="active">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.active') }}</dt>
        <dd class="text-gray-900 dark:text-white"><YesNoMark :value="alias.active" /></dd>
      </div>
    </DataCardFields>
  </DataCard>
</template>

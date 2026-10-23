<script setup lang="ts">
import ActiveBadge from '@/shared/components/ActiveBadge.vue'

import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

// A domain alias as a card below md (FR-033), the classic table's columns
// (`draw_aliasdomain_table()`): the name as heading with a link to its page, the target domain and
// active. Slots: `select` (selection mode, US6) and `actions` (the entry menu).
import { computed } from 'vue'

import type { AliasDomain } from '@/api'

import { lt } from '@/i18n'
import DomainNameText from '@/shared/components/DomainNameText.vue'

import TargetDomainText from './TargetDomainText.vue'

const props = defineProps<{ aliasDomain: AliasDomain; linkDomains: boolean }>()
const headingId = computed(() => `alias-domain-card-${props.aliasDomain.name}`)
</script>

<template>
  <DataCard
    :data-entry="aliasDomain.name"
    :title-id="headingId"
    :to="{ name: 'alias-domain-detail', params: { aliasDomain: aliasDomain.name } }"
  >
    <template #badges><ActiveBadge :active="aliasDomain.active" /></template>
    <template #title>
      <DomainNameText :name="aliasDomain.name" :unicode-name="aliasDomain.nameUnicode" />
    </template>
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <DataCardFields>
      <div class="flex min-w-0 flex-col">
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('mailbox.target_domain') }}</dt>
        <dd class="min-w-0 text-gray-900 dark:text-white">
          <TargetDomainText :alias-domain="aliasDomain" :link-domains="linkDomains" />
        </dd>
      </div>
    </DataCardFields>
  </DataCard>
</template>

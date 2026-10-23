<script setup lang="ts">
import ActiveBadge from '@/shared/components/ActiveBadge.vue'

import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

import RowAction from '@/shared/components/RowAction.vue'

// An MTA-STS policy as a card below md (FR-055): a list item named by its heading (the readable
// domain with the ASCII form, opening the domain page at its MTA-STS section), the active badge,
// mode, MX servers, max age and identifier.
import { useI18n } from 'vue-i18n'

import type { MtaStsPolicy } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'

defineProps<{ policy: MtaStsPolicy }>()
const { t, locale } = useI18n()
</script>

<template>
  <DataCard
    :data-entry="policy.domain"
    :to="{ name: 'domain-detail', params: { domain: policy.domain }, hash: '#mta-sts' }"
  >
    <template #badges><ActiveBadge :active="policy.active" /></template>
    <template #title>
      <DomainNameText :name="policy.domain" :unicode-name="policy.displayDomain" />
    </template>
    <template #actions>
      <RowAction
        :menu="false"
        :label="`${lt('mailbox.edit')}: ${policy.displayDomain}`"
        :to="{ name: 'domain-detail', params: { domain: policy.domain }, hash: '#mta-sts' }"
      >
        {{ lt('mailbox.edit') }}
      </RowAction>
    </template>
    <DataCardFields>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.mta_sts_mode') }}</dt>
        <dd class="font-mono text-gray-900 dark:text-white">{{ policy.mode }}</dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.mta_sts_max_age') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          {{ formatNumber(policy.maxAge, locale as AppLocale) }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.mta_sts_mx') }}</dt>
        <dd class="font-mono break-all text-gray-900 dark:text-white">
          {{ policy.mxHosts.join(', ') }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.mtaSts.sort.policyId') }}</dt>
        <dd class="font-mono text-gray-900 dark:text-white">{{ policy.policyId }}</dd>
      </div>
    </DataCardFields>
  </DataCard>
</template>

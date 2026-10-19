<script setup lang="ts">
// An MTA-STS policy as a card below md (FR-055): a list item named by its heading (the readable
// domain with the ASCII form, opening the domain page at its MTA-STS section), the active badge,
// mode, MX servers, max age and identifier.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { MtaStsPolicy } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import DomainNameText from '@/shared/components/DomainNameText.vue'

import MtaStsActiveBadge from './MtaStsActiveBadge.vue'

defineProps<{ policy: MtaStsPolicy }>()
const { t, locale } = useI18n()
</script>

<template>
  <li
    :data-entry="policy.domain"
    class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
    <h3 class="text-base font-semibold text-gray-900 dark:text-white">
      <RouterLink
        :to="{ name: 'domain-detail', params: { domain: policy.domain }, hash: '#mta-sts' }"
        class="inline-flex min-h-11 items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <DomainNameText :name="policy.domain" :unicode-name="policy.displayDomain" />
      </RouterLink>
    </h3>
    <div><MtaStsActiveBadge :active="policy.active" /></div>
    <dl class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
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
    </dl>
  </li>
</template>

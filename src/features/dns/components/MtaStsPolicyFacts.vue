<script setup lang="ts">
// An MTA-STS policy as the section shows it (FR-046): the classic tab's fields (version, mode, max
// age in seconds, MX server, active), then the identifier, the address the policy is published at
// (a new tab) and the policy text that is served.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MtaStsPolicy } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import { ExternalLinkIcon } from '@/shared/icons'
import { safeHref } from '@/shared/security/safe-url'

import MtaStsActiveBadge from './MtaStsActiveBadge.vue'
import RecordValue from './RecordValue.vue'

const props = defineProps<{ policy: MtaStsPolicy }>()
const { t, locale } = useI18n()
const href = computed(() => safeHref(props.policy.policyUrl))
</script>

<template>
  <div class="flex flex-col gap-4">
    <dl data-mta-sts-facts class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.mta_sts_version') }}</dt>
        <dd class="font-mono text-gray-900 dark:text-white">{{ policy.version }}</dd>
      </div>
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
          <ul>
            <li v-for="host in policy.mxHosts" :key="host">{{ host }}</li>
          </ul>
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.active') }}</dt>
        <dd><MtaStsActiveBadge :active="policy.active" /></dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.mtaSts.sort.policyId') }}</dt>
        <dd data-policy-id class="font-mono text-gray-900 dark:text-white">
          {{ policy.policyId }}
        </dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.mtaSts.policyUrl') }}</dt>
        <dd class="break-all">
          <a
            v-if="href"
            :href="href"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center gap-1 text-brand-700 underline underline-offset-2 dark:text-brand-300"
          >
            {{ policy.policyUrl }}
            <ExternalLinkIcon class="size-4 shrink-0" />
            <span class="sr-only">{{ t('common.opensInNewTab') }}</span>
          </a>
          <span v-else class="font-mono">{{ policy.policyUrl }}</span>
        </dd>
      </div>
    </dl>
    <RecordValue
      :label="t('dns.mtaSts.policyText')"
      :value="policy.policyText"
      :copy-label="t('dns.mtaSts.copyPolicyText', { domain: policy.displayDomain })"
      multiline
    />
  </div>
</template>

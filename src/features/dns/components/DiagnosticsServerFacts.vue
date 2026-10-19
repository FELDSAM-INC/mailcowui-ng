<script setup lang="ts">
// The server facts of a diagnostics result (FR-064): host name, public IPv4 and IPv6 addresses
// ("no public IPv6 address" when there is none) and when the check ran.
import { useI18n } from 'vue-i18n'

import type { DnsDiagnosticsResult } from '@/api'
import DateTime from '@/shared/components/DateTime.vue'

defineProps<{ result: DnsDiagnosticsResult }>()
const { t } = useI18n()
</script>

<template>
  <section
    data-server-facts
    aria-labelledby="server-facts-title"
    class="rounded-2xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="server-facts-title" class="font-semibold text-gray-900 dark:text-white">
      {{ t('dns.diagnostics.facts.title') }}
    </h2>
    <dl class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.diagnostics.facts.hostname') }}</dt>
        <dd class="font-mono break-all text-gray-900 dark:text-white">
          {{ result.serverHostname }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.diagnostics.facts.ipv4') }}</dt>
        <dd class="font-mono break-all text-gray-900 dark:text-white">
          {{ result.publicIpv4 ?? '–' }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.diagnostics.facts.ipv6') }}</dt>
        <dd class="break-all text-gray-900 dark:text-white">
          <span v-if="result.publicIpv6" class="font-mono">{{ result.publicIpv6 }}</span>
          <span v-else data-no-ipv6>{{ t('dns.diagnostics.facts.noIpv6') }}</span>
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.diagnostics.facts.checkedAt') }}</dt>
        <dd class="text-gray-900 dark:text-white"><DateTime :value="result.checkedAt" /></dd>
      </div>
    </dl>
  </section>
</template>

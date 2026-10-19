<script setup lang="ts">
// The server's DKIM settings, read-only, for administrators (FR-015): the default selector and key
// length of new keys, and whether private key export and DNS publication are on.
import { useI18n } from 'vue-i18n'

import type { DnsCapabilities } from '@/api'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

defineProps<{ caps: DnsCapabilities }>()
const { t, locale } = useI18n()
const onOff = (value: boolean | null) =>
  value ? t('dns.dkim.settings.on') : t('dns.dkim.settings.off')
</script>

<template>
  <section
    data-dkim-settings
    aria-labelledby="dkim-settings-title"
    class="rounded-2xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="dkim-settings-title" class="font-semibold text-gray-900 dark:text-white">
      {{ t('dns.dkim.settings.title') }}
    </h2>
    <dl class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt class="text-gray-600 dark:text-gray-400">
          {{ t('dns.dkim.settings.defaultSelector') }}
        </dt>
        <dd class="font-mono break-all text-gray-900 dark:text-white">
          {{ caps.dkim.defaultSelector }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">
          {{ t('dns.dkim.settings.defaultKeySize') }}
        </dt>
        <dd class="text-gray-900 dark:text-white">
          {{ formatNumber(caps.dkim.defaultKeySize, locale as AppLocale) }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.dkim.settings.export') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          {{ onOff(caps.dkim.privateKeyExportEnabled) }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.publication.title') }}</dt>
        <dd class="text-gray-900 dark:text-white">{{ onOff(caps.dkim.dnsPublicationEnabled) }}</dd>
      </div>
    </dl>
  </section>
</template>
